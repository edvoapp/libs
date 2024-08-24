use crate::get_app_controller;
use crate::wgpu_renderer::WgpuRenderer;

use js_listener::JsEventListener;
use wasm_bindgen::prelude::Closure;
use web_sys::HtmlCanvasElement;

pub struct GraphicsContext {
    #[cfg(target_arch = "wasm32")]
    canvas: HtmlCanvasElement,
    pub surface: wgpu::Surface,
    pub adapter: wgpu::Adapter,
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    pub viewport_bind_group_layout: wgpu::BindGroupLayout,
    pub viewport_buffer: wgpu::Buffer,
    pub config: wgpu::SurfaceConfiguration, // to be mutated on resize
    pub viewport_bind_group: wgpu::BindGroup, // to be mutated on resize
    pub view: wgpu::TextureView,            // to be mutated on resize
    pub depth_buffer: wgpu::TextureView,    // to be mutated on resize
    pub dpr: f32,                           // to be mutated on dpr change
    #[allow(dead_code)]
    contextlost_listener: JsEventListener,
}

impl GraphicsContext {
    pub async fn new(renderer: &WgpuRenderer) -> Self {
        use wasm_bindgen::JsCast;

        let window = web_sys::window().expect("no global `window` exists");
        let scale_factor = window.device_pixel_ratio();
        let logical_width = window.inner_width().unwrap().as_f64().unwrap();
        let logical_height = window.inner_height().unwrap().as_f64().unwrap();

        let document = window.document().expect("should have a document on window");
        let body = document.body().expect("document should have a body");
        let canvas: web_sys::HtmlCanvasElement = document
            .create_element("canvas")
            .expect("create a canvas element")
            .unchecked_into();

        body.append_child(&canvas).expect("append canvas to body");

        canvas.set_class_name("wgpu-surface");
        canvas.set_width((logical_width * scale_factor) as u32);
        canvas.set_height((logical_height * scale_factor) as u32);
        canvas.style().set_css_text("width: 100%; height: 100%;");

        let weak_renderer = renderer.weak();

        // This is atypical, but it just so happens we don't need to worry about
        // unbinding the event because the canvas element itself gets removed when
        // this struct is dropped.
        let webglcontextlost_callback = Closure::once(move || {
            if let Some(r) = weak_renderer.upgrade() {
                r.evict_context();
            }
            get_app_controller().conditionally_init_context();
        });

        let contextlost_listener =
            JsEventListener::new(&canvas, "webglcontextlost", webglcontextlost_callback);

        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::default());

        // #[cfg(target_arch = "wasm32")]
        let surface = instance.create_surface_from_canvas(&canvas).unwrap();

        // TODO: Fix this for native.
        // #[cfg(not(target_arch = "wasm32"))]
        // let surface = unsafe { instance.create_surface(&window) }.unwrap();

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::default(),
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .unwrap();
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("device & queue"),
                    features: wgpu::Features::empty(),
                    limits: wgpu::Limits {
                        max_texture_dimension_2d: wgpu::Limits::default().max_texture_dimension_2d,
                        ..wgpu::Limits::downlevel_webgl2_defaults()
                    },
                },
                None,
            )
            .await
            .unwrap();

        // Viewport bind group
        let viewport_bind_group_layout =
            device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                entries: &[wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                }],
                label: Some("viewport bind group layout"),
            });

        let viewport_uniform = ViewportUniform::new(logical_width as f32, logical_height as f32);

        let tex_formats = surface.get_capabilities(&adapter).formats;
        log::info!("available view formats: {tex_formats:?}");

        // TODO: Handle this as a match statement so we have better error handling?
        // let format = tex_formats[0];
        // Use `Rgba8Unorm` for now as we currently don't have the conversion
        // implemented for sRGB.
        let format = wgpu::TextureFormat::Rgba8Unorm;

        let config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width: (logical_width * scale_factor) as u32,
            height: (logical_height * scale_factor) as u32,
            present_mode: wgpu::PresentMode::AutoVsync,
            alpha_mode: wgpu::CompositeAlphaMode::Auto,
            view_formats: Vec::new(),
        };

        surface.configure(&device, &config);

        let multisampled_frame_descriptor = wgpu::TextureDescriptor {
            label: Some("multisampled frame descriptor"),
            size: wgpu::Extent3d {
                width: config.width,
                height: config.height,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 4,
            dimension: wgpu::TextureDimension::D2,
            format: config.format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        };

        use wgpu::util::DeviceExt;
        let view = device
            .create_texture(&multisampled_frame_descriptor)
            .create_view(&wgpu::TextureViewDescriptor::default());
        let viewport_buffer = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("viewport buffer"),
            contents: bytemuck::cast_slice(&[viewport_uniform]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        let viewport_bind_group = device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &viewport_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: viewport_buffer.as_entire_binding(),
            }],
            label: Some("viewport bind group"),
        });

        let depth_view = DepthTexture::create_depth_view(&device, &config, "depth buffer");

        Self {
            #[cfg(target_arch = "wasm32")]
            canvas,
            surface,
            adapter,
            device,
            queue,
            viewport_bind_group_layout,
            viewport_buffer,
            config,
            viewport_bind_group,
            view,
            depth_buffer: depth_view,
            contextlost_listener,
            dpr: scale_factor as f32,
        }
    }

    fn update_surface(&mut self, width: u32, height: u32) {
        self.config = wgpu::SurfaceConfiguration {
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            format: wgpu::TextureFormat::Rgba8Unorm,
            width,
            height,
            present_mode: wgpu::PresentMode::AutoVsync,
            alpha_mode: wgpu::CompositeAlphaMode::Auto,
            view_formats: Vec::new(),
        };
        self.surface.configure(&self.device, &self.config);
    }

    fn update_view(&mut self, width: f32, height: f32, dpr: f32) {
        let multisampled_frame_descriptor = wgpu::TextureDescriptor {
            label: Some("multisampled frame descriptor"),
            size: wgpu::Extent3d {
                width: (width * dpr) as u32,
                height: (height * dpr) as u32,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 4,
            dimension: wgpu::TextureDimension::D2,
            format: self.config.format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        };

        let viewport_uniform = ViewportUniform::new(width, height);

        self.view = self
            .device
            .create_texture(&multisampled_frame_descriptor)
            .create_view(&wgpu::TextureViewDescriptor::default());

        self.queue.write_buffer(
            &self.viewport_buffer,
            0,
            bytemuck::cast_slice(&[viewport_uniform]),
        );

        self.viewport_bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            layout: &self.viewport_bind_group_layout,
            entries: &[wgpu::BindGroupEntry {
                binding: 0,
                resource: self.viewport_buffer.as_entire_binding(),
            }],
            label: Some("viewport bind group"),
        });

        self.depth_buffer =
            DepthTexture::create_depth_view(&self.device, &self.config, "depth buffer");
    }

    pub fn configure(&mut self, width: f32, height: f32, dpr: f32) {
        let w = (width * dpr) as u32;
        let h = (height * dpr) as u32;
        self.dpr = dpr;
        self.canvas.set_width(w);
        self.canvas.set_height(h);
        self.update_surface(w, h);
        self.update_view(width, height, dpr);
    }
}

impl std::ops::Drop for GraphicsContext {
    fn drop(&mut self) {
        #[cfg(target_arch = "wasm32")]
        {
            let window = web_sys::window().expect("no global `window` exists");
            let document = window.document().expect("should have a document on window");
            let body = document.body().expect("document should have a body");
            let _ = body.remove_child(&self.canvas);
        }
        log::info!("GraphicsContext dropped");
    }
}

#[repr(C)]
#[derive(Debug, Copy, Clone, bytemuck::Pod, bytemuck::Zeroable)]
pub struct ViewportUniform {
    factor: [f32; 2],
    _padding: [f32; 2],
}

impl ViewportUniform {
    pub fn new(width: f32, height: f32) -> Self {
        Self {
            factor: [width, height],
            _padding: [0.0; 2],
        }
    }
}

pub struct DepthTexture;
impl DepthTexture {
    pub const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float;
    fn create_depth_view(
        device: &wgpu::Device,
        config: &wgpu::SurfaceConfiguration,
        label: &str,
    ) -> wgpu::TextureView {
        let size = wgpu::Extent3d {
            width: config.width,
            height: config.height,
            depth_or_array_layers: 1,
        };
        let desc = wgpu::TextureDescriptor {
            label: Some(label),
            size,
            mip_level_count: 1,
            sample_count: 4,
            dimension: wgpu::TextureDimension::D2,
            format: Self::DEPTH_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT,
            view_formats: &[],
        };
        let texture = device.create_texture(&desc);
        texture.create_view(&wgpu::TextureViewDescriptor::default())
    }
}
