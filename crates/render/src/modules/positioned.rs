use super::wgpu_render_module::WgpuRenderModule;
use super::{RenderModuleConfig, Update};
use crate::context::{DepthTexture, GraphicsContext};
use crate::model::BufferRecord;
use crate::util::types::ObjectKind;
use crate::wgpu_renderer::WgpuRenderer;
use crate::{get_app_controller, get_renderer};
use edvo_viewmodel::boundingbox::BoundingBox;

use std::any::Any;
use std::cell::RefCell;
use std::num::NonZeroU64;
use std::rc::Rc;

use wgpu::util::DeviceExt;

struct State<V, I> {
    vertices: Vec<V>,
    indices: Vec<u16>,
    instances: Vec<I>,
    clipbox: Option<BoundingBox>,
}

struct ModuleContext {
    render_pipeline: wgpu::RenderPipeline,
    buffers: Buffers,
    clipbox: Option<BoundingBox>,
}

impl ModuleContext {
    // TODO: consider creating a proper Err type here
    fn new<V, I>(config: &RenderModuleConfig, renderer: &WgpuRenderer) -> Result<Self, String>
    where
        V: BufferRecord,
        I: BufferRecord,
    {
        let Some(ref context) = *renderer.context.borrow() else {
            return Err(String::from("graphics context does not exist"));
        };

        let label = format!("{}: positioned render pipeline", config.name);

        let render_pipeline_layout =
            context
                .device
                .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some(&label), // layout
                    bind_group_layouts: &[&context.viewport_bind_group_layout],
                    push_constant_ranges: &[],
                });

        let shader = context
            .device
            .create_shader_module(config.shader_desc.clone());

        let render_pipeline =
            context
                .device
                .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                    label: Some(&label),
                    layout: Some(&render_pipeline_layout),
                    vertex: wgpu::VertexState {
                        module: &shader,
                        entry_point: "vs_main",
                        buffers: &[V::desc(), I::desc()],
                    },
                    fragment: Some(wgpu::FragmentState {
                        module: &shader,
                        entry_point: "fs_main",
                        targets: &[Some(wgpu::ColorTargetState {
                            format: context.config.format,
                            blend: config.blend,
                            write_mask: wgpu::ColorWrites::ALL,
                        })],
                    }),
                    primitive: wgpu::PrimitiveState {
                        topology: config.topology,
                        strip_index_format: None,
                        polygon_mode: wgpu::PolygonMode::Fill,
                        ..wgpu::PrimitiveState::default()
                    },
                    depth_stencil: Some(wgpu::DepthStencilState {
                        format: DepthTexture::DEPTH_FORMAT,
                        depth_write_enabled: config.depth_write_enabled,
                        depth_compare: wgpu::CompareFunction::GreaterEqual,
                        stencil: wgpu::StencilState::default(),
                        bias: wgpu::DepthBiasState::default(),
                    }),
                    multisample: wgpu::MultisampleState {
                        count: 4,
                        mask: !0,
                        alpha_to_coverage_enabled: false,
                    },
                    multiview: None,
                });

        Ok(Self {
            render_pipeline,
            buffers: Buffers::default(),
            clipbox: None,
        })
    }
}

pub struct PositionedRenderModule<V, I> {
    config: RenderModuleConfig,
    state: RefCell<State<V, I>>,
    module_context: RefCell<Option<Rc<ModuleContext>>>,
}

#[derive(Default)]
struct Buffers {
    vertex: Option<Rc<VertexData>>,
    instance: Option<Rc<InstanceData>>,
}

struct VertexData {
    vertex: wgpu::Buffer,
    index: wgpu::Buffer,
    vertex_size: wgpu::BufferSize,
    index_size: wgpu::BufferSize,
    index_count: usize,
}

pub enum DataError {
    ZeroSize,
}
pub enum FlushError {
    NoContext,
    DataInUse,
    DataError(DataError),
}

impl From<DataError> for FlushError {
    fn from(error: DataError) -> Self {
        FlushError::DataError(error)
    }
}

impl VertexData {
    fn new<V: bytemuck::Pod>(
        device: &wgpu::Device,
        vertices: &[V],
        indices: &[u16],
    ) -> Result<Self, DataError> {
        Ok(Self {
            vertex: device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("vertex buffer"),
                contents: bytemuck::cast_slice(vertices),
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            }),
            index: device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("index buffer"),
                contents: bytemuck::cast_slice(indices),
                usage: wgpu::BufferUsages::INDEX | wgpu::BufferUsages::COPY_DST,
            }),
            vertex_size: NonZeroU64::new((vertices.len() * std::mem::size_of::<V>()) as u64)
                .ok_or(DataError::ZeroSize)?,

            index_size: NonZeroU64::new((indices.len() * std::mem::size_of::<u16>()) as u64)
                .ok_or(DataError::ZeroSize)?,
            index_count: indices.len(),
        })
    }
}

#[derive(Debug)]
struct InstanceData {
    instance: wgpu::Buffer,
    instance_size: wgpu::BufferSize,
    instance_count: u32,
}

impl InstanceData {
    fn new<I: bytemuck::Pod>(device: &wgpu::Device, instances: &[I]) -> Result<Self, DataError> {
        Ok(Self {
            instance: device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("instance buffer"),
                contents: bytemuck::cast_slice(instances),
                usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
            }),
            instance_size: NonZeroU64::new((instances.len() * std::mem::size_of::<I>()) as u64)
                .ok_or(DataError::ZeroSize)?,
            instance_count: instances.len() as u32,
        })
    }
}

impl<V, I> PositionedRenderModule<V, I>
where
    V: BufferRecord,
    I: BufferRecord,
{
    pub fn new(config: RenderModuleConfig) -> Rc<Self> {
        let me = Rc::new(PositionedRenderModule {
            config,
            state: RefCell::new(State {
                vertices: Vec::new(),
                indices: Vec::new(),
                instances: Vec::new(),
                clipbox: None,
            }),
            module_context: RefCell::new(None),
        });

        if let Some(ref renderer) = get_renderer() {
            let weak = Rc::downgrade(&me);
            renderer.register_module(weak);
            let _ = me.try_init_module_context(renderer);
        }

        me
    }

    fn try_init_module_context(&self, renderer: &WgpuRenderer) -> Result<(), String> {
        let mut module_context = self.module_context.borrow_mut();
        if module_context.is_none() {
            *module_context = Some(Rc::new(ModuleContext::new::<V, I>(&self.config, renderer)?));
        }
        Ok(())
    }

    /// Updates vertex and index buffers with the given vertices and indices
    /// by either overwriting the existing buffers or creating new ones.
    ///
    /// Note: This does not update the instance buffer.
    ///       Use [`PositionedRenderModule::update_instances`] for that.
    pub fn update<'a, U: Into<Update<'a, V>>>(&'a self, update: U) {
        let Update { vertices, indices } = update.into();
        let (len_v, len_i) = {
            let state = self.state.borrow();
            (state.vertices.len(), state.indices.len())
        };

        // Update the state with the new vertices and indices.
        {
            let mut state = self.state.borrow_mut();
            state.vertices.clear();
            state.vertices.extend(vertices.iter());
            state.indices.clear();
            state.indices.extend(indices.iter());
        }

        if let Some(ref renderer) = get_renderer() {
            let Ok(_) = self.try_init_module_context(renderer) else {
                return;
            };
            let Some(ref mut module_context) = *self.module_context.borrow_mut() else {
                return;
            };
            let Some(module_context) = Rc::get_mut(module_context) else {
                log::warn!("shohei - no module_context (reinitialize_context)");
                return;
            };
            match self.flush_vertex_buffers(
                renderer,
                module_context,
                vertices,
                indices,
                len_v,
                len_i,
            ) {
                Ok(()) => (),
                Err(FlushError::NoContext) => {
                    log::warn!("No graphics context");
                }
                Err(FlushError::DataInUse) => {
                    log::warn!("Data in use");
                }
                Err(FlushError::DataError(DataError::ZeroSize)) => {
                    log::warn!("Zero size buffer");
                }
            }
        }
    }

    /// Updates the instances buffer with the given instances
    /// by either overwriting the existing buffer or creating a new one.
    pub fn update_instances(&self, instances: &[I], clipbox: Option<BoundingBox>) {
        let len_instances = {
            let state = self.state.borrow();
            state.instances.len()
        };

        // Update the state with the new instances and clipbox.
        {
            let mut state = self.state.borrow_mut();
            state.instances.clear();
            state.instances.extend(instances);
            state.clipbox = clipbox;
        }

        if let Some(ref renderer) = get_renderer() {
            let Ok(_) = self.try_init_module_context(renderer) else {
                return;
            };
            let Some(ref mut module_context) = *self.module_context.borrow_mut() else {
                return;
            };
            let Some(module_context) = Rc::get_mut(module_context) else {
                log::warn!("shohei - no module_context (reinitialize_context)");
                return;
            };
            match self.flush_instance_buffers(renderer, module_context, instances, len_instances) {
                Ok(()) => (),
                Err(FlushError::NoContext) => {
                    log::warn!("No graphics context");
                }
                Err(FlushError::DataInUse) => {
                    log::warn!("Data in use");
                }
                Err(FlushError::DataError(DataError::ZeroSize)) => {
                    log::warn!("Zero size buffer");
                }
            };
        }
    }

    fn flush_vertex_buffers(
        &self,
        renderer: &WgpuRenderer,
        module_context: &mut ModuleContext,
        vertices: &[V],
        indices: &[u16],
        len_v: usize,
        len_i: usize,
    ) -> Result<(), FlushError> {
        let Some(ref context) = *renderer.context.borrow() else {
            return Err(FlushError::NoContext);
        };

        match module_context.buffers.vertex.as_mut() {
            Some(vd)
                if vd.vertex.size() != 0
                    && vd.index.size() != 0
                    && len_v >= vertices.len()
                    && len_i >= indices.len() =>
            {
                let Some(vd) = Rc::get_mut(vd) else {
                    return Err(FlushError::DataInUse);
                };

                // Overwrite vertex buffer.
                {
                    vd.vertex_size =
                        NonZeroU64::new((vertices.len() * std::mem::size_of::<V>()) as u64)
                            .ok_or(DataError::ZeroSize)?;

                    if let Some(mut view) =
                        context
                            .queue
                            .write_buffer_with(&vd.vertex, 0, vd.vertex_size)
                    {
                        view.copy_from_slice(bytemuck::cast_slice(vertices));
                    }
                }

                // Overwrite index buffer.
                {
                    // Ensure that the indices are aligned to 4 bytes for compatibility with WebGPU APIs.
                    let indices = pad_to_4_bytes(indices);

                    vd.index_size =
                        NonZeroU64::new((indices.len() * std::mem::size_of::<u16>()) as u64)
                            .ok_or(DataError::ZeroSize)?;

                    if let Some(mut view) =
                        context.queue.write_buffer_with(&vd.index, 0, vd.index_size)
                    {
                        view.copy_from_slice(bytemuck::cast_slice(&indices));
                    }
                }

                // Update index count.
                vd.index_count = indices.len();
            }
            _ => PositionedRenderModule::<V, I>::create_vertex_buffer(
                module_context,
                context,
                vertices,
                indices,
            )?,
        }

        get_app_controller().redraw();
        Ok(())
    }

    fn flush_instance_buffers(
        &self,
        renderer: &WgpuRenderer,
        module_context: &mut ModuleContext,
        instances: &[I],
        len_instances: usize,
    ) -> Result<(), FlushError> {
        let Some(ref context) = *renderer.context.borrow() else {
            return Err(FlushError::NoContext);
        };

        match module_context.buffers.instance.as_mut() {
            Some(id) if id.instance.size() != 0 && len_instances >= instances.len() => {
                let Some(id) = Rc::get_mut(id) else {
                    return Err(FlushError::DataInUse);
                };

                // Overwrite instance buffer.
                {
                    id.instance_size =
                        NonZeroU64::new((instances.len() * std::mem::size_of::<I>()) as u64)
                            .ok_or(DataError::ZeroSize)?;

                    if let Some(mut view) =
                        context
                            .queue
                            .write_buffer_with(&id.instance, 0, id.instance_size)
                    {
                        view.copy_from_slice(bytemuck::cast_slice(instances));
                    }
                }

                // Update instance count.
                id.instance_count = instances.len() as u32;
            }
            _ => {
                PositionedRenderModule::<V, I>::create_instance_buffer(
                    module_context,
                    context,
                    instances,
                )?;
            }
        }

        get_app_controller().redraw();
        Ok(())
    }

    fn create_vertex_buffer(
        module_context: &mut ModuleContext,
        context: &GraphicsContext,
        vertices: &[V],
        indices: &[u16],
    ) -> Result<(), DataError> {
        let vertex = Some(Rc::new(VertexData::new(
            &context.device,
            vertices,
            indices,
        )?));
        let instance = module_context.buffers.instance.clone();
        module_context.buffers = Buffers { vertex, instance };
        Ok(())
    }

    fn create_instance_buffer(
        module_context: &mut ModuleContext,
        context: &GraphicsContext,
        instances: &[I],
    ) -> Result<(), DataError> {
        let instance = Some(Rc::new(InstanceData::new(&context.device, instances)?));
        let vertex = module_context.buffers.vertex.clone();
        module_context.buffers = Buffers { vertex, instance };
        Ok(())
    }
}

impl<V, I> std::ops::Drop for PositionedRenderModule<V, I> {
    fn drop(&mut self) {
        get_app_controller().redraw();
    }
}

impl<V, I> WgpuRenderModule for PositionedRenderModule<V, I>
where
    V: BufferRecord,
    I: BufferRecord,
{
    fn module_context(&self) -> Option<Rc<dyn Any>> {
        let Some(ref module_context) = *self.module_context.borrow() else {
            return None;
        };
        Some(module_context.clone() as Rc<dyn Any>)
    }

    fn render<'module: 'pass, 'pass>(
        &'module self,
        pass: &mut wgpu::RenderPass<'pass>,
        module_context: &'module Rc<dyn Any>,
        viewport_bind_group: &'pass wgpu::BindGroup,
        surface_config: &wgpu::SurfaceConfiguration,
        dpr: f32,
    ) {
        let ModuleContext {
            render_pipeline,
            buffers,
            clipbox,
        } = (*module_context).downcast_ref::<ModuleContext>().unwrap();

        let Buffers {
            vertex: Some(vertex),
            instance: Some(instance),
        } = buffers
        else {
            return;
        };

        let vertex_size = vertex.vertex_size.get();
        let index_size = vertex.index_size.get();

        pass.set_pipeline(render_pipeline);
        pass.set_bind_group(0, viewport_bind_group, &[]);
        pass.set_index_buffer(vertex.index.slice(..index_size), wgpu::IndexFormat::Uint16);
        pass.set_vertex_buffer(0, vertex.vertex.slice(..vertex_size));
        pass.set_vertex_buffer(1, instance.instance.slice(..));

        match clipbox {
            Some(b) => {
                let viewport = BoundingBox::from_xyhw(
                    0.0,
                    0.0,
                    surface_config.height as f32,
                    surface_config.width as f32,
                );
                if let Some(b) = b.scale(dpr).intersect(&viewport) {
                    pass.set_scissor_rect(
                        b.x() as u32,
                        b.y() as u32,
                        b.width() as u32,
                        b.height() as u32,
                    )
                } else {
                    pass.set_scissor_rect(0, 0, surface_config.width, surface_config.height);
                }
            }
            None => pass.set_scissor_rect(0, 0, surface_config.width, surface_config.height),
        }

        let index_count = vertex.index_count as u32;
        pass.draw_indexed(0..index_count, 0, 0..instance.instance_count);
    }

    fn kind(&self) -> ObjectKind {
        self.config.kind
    }

    fn evict_module_context(&self) {
        *self.module_context.borrow_mut() = None;
    }

    fn reinit_module_context(&self, renderer: &WgpuRenderer) {
        let Ok(_) = self.try_init_module_context(renderer) else {
            return;
        };
        let Some(ref mut module_context) = *self.module_context.borrow_mut() else {
            return;
        };
        let Some(module_context) = Rc::get_mut(module_context) else {
            return;
        };

        let State {
            vertices,
            indices,
            instances,
            clipbox,
        } = &*self.state.borrow();
        module_context.clipbox = clipbox.clone();

        match self.flush_vertex_buffers(
            renderer,
            module_context,
            vertices,
            indices,
            vertices.len(),
            indices.len(),
        ) {
            Ok(()) => (),
            Err(FlushError::NoContext) => {
                log::warn!("No graphics context");
            }
            Err(FlushError::DataInUse) => {
                log::warn!("Data in use");
            }
            Err(FlushError::DataError(DataError::ZeroSize)) => {
                log::warn!("Zero size buffer");
            }
        }
        match self.flush_instance_buffers(renderer, module_context, instances, instances.len()) {
            Ok(()) => (),
            Err(FlushError::NoContext) => {
                log::warn!("No graphics context");
            }
            Err(FlushError::DataInUse) => {
                log::warn!("Data in use");
            }
            Err(FlushError::DataError(DataError::ZeroSize)) => {
                log::warn!("Zero size buffer");
            }
        }
    }
}

/// Pads the given slice to ensure it is a multiple of 4 bytes
/// by duplicating the last index if necessary.
fn pad_to_4_bytes(slice: &[u16]) -> Vec<u16> {
    let mut padded = Vec::from(slice);
    if slice.len() % 2 != 0 {
        padded.push(*slice.last().unwrap()); // safe because slice is non-empty if len % 2 != 0
    }
    padded
}
