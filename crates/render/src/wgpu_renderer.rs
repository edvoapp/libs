use futures::lock::Mutex;
use wasm_bindgen_futures::spawn_local;

use crate::context::GraphicsContext;
use crate::modules::WgpuRenderModule;

use std::any::Any;
use std::ops::Deref;
use std::rc::Weak;
use std::{cell::RefCell, rc::Rc};

pub enum SubscriptionState {
    Continue,
    Unsubscribe,
}

struct State {
    module_instances: Vec<Weak<dyn WgpuRenderModule>>,
}

#[derive(Clone)]
pub struct RenderItem {
    module: Rc<dyn WgpuRenderModule>,
    module_context: Rc<dyn Any>,
}

#[derive(Clone)]
pub struct WgpuRenderer(Rc<WgpuRenderInner>);

impl Deref for WgpuRenderer {
    type Target = WgpuRenderInner;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

pub struct WgpuRenderInner {
    pub context: RefCell<Option<GraphicsContext>>,
    initializing: Mutex<()>,
    state: RefCell<State>,
    render_items: RefCell<Vec<RenderItem>>,
}

#[derive(Clone)]
pub struct WeakWgpuRenderer(Weak<WgpuRenderInner>);

impl WeakWgpuRenderer {
    pub fn upgrade(&self) -> Option<WgpuRenderer> {
        Some(WgpuRenderer(self.0.upgrade()?))
    }
}

impl WgpuRenderer {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        let inner = WgpuRenderInner {
            context: RefCell::new(None),
            initializing: Mutex::new(()),
            state: RefCell::new(State {
                module_instances: Vec::new(),
            }),
            render_items: RefCell::new(Vec::new()),
        };
        Self(Rc::new(inner))
    }

    /// Initialize the context if we don't have one AND we are visible
    pub fn conditionally_init_context(&self) {
        let nocontext = self.context.borrow().is_none();
        if nocontext {
            spawn_local(self.clone().init_context());
        }
    }

    async fn init_context(self) {
        let _guard = if let Some(g) = self.initializing.try_lock() {
            g
        } else {
            // already initializing - fail silently
            return;
        };

        let context = GraphicsContext::new(&self).await;

        {
            *self.context.borrow_mut() = Some(context);
        }

        self.each_module(&mut |m: &dyn WgpuRenderModule| {
            m.reinit_module_context(&self);
        });
    }

    pub fn weak(&self) -> WeakWgpuRenderer {
        WeakWgpuRenderer(Rc::downgrade(&self.0))
    }

    pub fn register_module(&self, module: Weak<dyn WgpuRenderModule>) {
        let mut state = self.state.borrow_mut();
        state.module_instances.push(module);
    }

    pub fn each_module<F>(&self, f: &mut F)
    where
        F: FnMut(&dyn WgpuRenderModule),
    {
        let mut state = self.state.borrow_mut();
        state.module_instances.retain(|weak| {
            if let Some(module) = weak.upgrade() {
                f(&*module);
                true
            } else {
                false
            }
        });
    }

    pub fn render_frame(&self) {
        // Do the conditional checking here and bail out early if we don't want to render.
        let Some(ref context) = *self.context.borrow() else {
            // Quietly abort the render if we have no context.
            return;
        };

        // Keep the vec around so we don't have to alloc for each frame.
        let mut render_items = self.render_items.borrow_mut();

        render_items.clear();

        // TODO: Consider using `self.each_module()` here.
        let mut state = self.state.borrow_mut();
        state.module_instances.retain(|weak| {
            if let Some(module) = weak.upgrade() {
                if let Some(module_context) = module.module_context() {
                    render_items.push(RenderItem {
                        module,
                        module_context,
                    });
                }
                true
            } else {
                false
            }
        });
        drop(state);

        if render_items.is_empty() {
            return;
        }

        let surface = &context.surface;
        let frame = match surface.get_current_texture() {
            Ok(frame) => frame,
            Err(_) => {
                surface.configure(&context.device, &context.config);
                surface
                    .get_current_texture()
                    .expect("failed to acquire next surface texture")
            }
        };

        // TODO: Check to see if we can safely store these in the context
        //       or if we have to create them each frame.
        let resolve_target = frame
            .texture
            .create_view(&wgpu::TextureViewDescriptor::default());

        let mut encoder = context
            .device
            .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                label: Some("render encoder"),
            });

        {
            let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("render pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &context.view,
                    resolve_target: Some(&resolve_target),
                    ops: wgpu::Operations {
                        #[cfg(target_arch = "wasm32")]
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        #[cfg(not(target_arch = "wasm32"))]
                        load: wgpu::LoadOp::Clear(wgpu::Color {
                            r: 0.6588235294117647,
                            g: 0.8549019607843137,
                            b: 0.8627450980392157,
                            a: 1.0,
                        }),
                        store: true,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &context.depth_buffer,
                    depth_ops: Some(wgpu::Operations {
                        load: wgpu::LoadOp::Clear(0.0),
                        store: true,
                    }),
                    stencil_ops: None,
                }),
            });

            for ri in &*render_items {
                let RenderItem {
                    module,
                    module_context,
                } = ri;
                module.render(
                    &mut pass,
                    module_context,
                    &context.viewport_bind_group,
                    &context.config,
                    context.dpr,
                );
            }

            drop(pass);
        }

        render_items.clear();

        context.queue.submit(Some(encoder.finish()));
        frame.present();
    }

    pub fn evict_context(&self) {
        *self.context.borrow_mut() = None;
        self.each_module(&mut |m: &dyn WgpuRenderModule| {
            m.evict_module_context();
        });
    }
}
