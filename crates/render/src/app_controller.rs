use crate::get_app_controller;
use crate::wgpu_renderer::{SubscriptionState, WgpuRenderer};

use std::ops::Deref;
use std::{cell::RefCell, rc::Rc};

use js_listener::JsEventListener;
use wasm_bindgen::prelude::*;
use winit::event::WindowEvent;
use winit::event_loop::ControlFlow;
use winit::{event::Event, event_loop::EventLoop, window::WindowBuilder};

type ListenerId = usize;

struct State {
    frame_listener_next_idx: usize,
    frame_listeners: Vec<(usize, Box<dyn FnMut() -> SubscriptionState + 'static>)>,
}

#[derive(Clone)]
#[wasm_bindgen]
pub struct AppController(Rc<AppControllerInner>);

impl Deref for AppController {
    type Target = AppControllerInner;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

pub struct AppControllerInner {
    pub renderer: WgpuRenderer,
    window: winit::window::Window,
    event_loop: RefCell<Option<EventLoop<()>>>,
    state: RefCell<State>,
    js_listeners: RefCell<Vec<JsEventListener>>,
}

#[wasm_bindgen]
impl AppController {
    pub fn run(self) {
        let event_loop = self.event_loop.take().unwrap();

        event_loop.set_control_flow(ControlFlow::Wait);
        let _ = event_loop.run(move |event, _elwt| {
            match event {
                // TODO: To be fixed.
                // #[cfg(not(target_arch = "wasm32"))]
                // Event::WindowEvent {
                //     ref event,
                //     window_id,
                // } if window_id == me.context.borrow().window.id() => match event {
                //     WindowEvent::CloseRequested
                //     | WindowEvent::KeyboardInput {
                //         input:
                //             KeyboardInput {
                //                 state: ElementState::Pressed,
                //                 virtual_keycode: Some(VirtualKeyCode::Escape),
                //                 ..
                //             },
                //         ..
                //     } => {
                //         control_flow.set_exit();
                //     }
                //     _ => {}
                // },
                Event::WindowEvent {
                    event: WindowEvent::RedrawRequested,
                    ..
                } => self.renderer.render_frame(),
                Event::AboutToWait => {
                    let mut state = self.state.borrow_mut();
                    state
                        .frame_listeners
                        .retain_mut(|(_id, listener)| match listener() {
                            SubscriptionState::Continue => true,
                            SubscriptionState::Unsubscribe => false,
                        });

                    // Important to drop the state borrow before we request redraw
                    // in case it executes the redraw immediately.
                    drop(state);
                }
                _ => {}
            }
        });
    }

    pub fn resize(&self, width: f32, height: f32, dpr: f32) {
        let controller = get_app_controller();

        // Doing this as a try_borrow_mut() to see if this is a contention issue or if it's something getting wedged.
        match controller.renderer.context.try_borrow_mut() {
            Ok(mut context) => {
                if let Some(context) = context.as_mut() {
                    log::info!("AppController: resize - width {width} height {height} dpr {dpr}");
                    context.configure(width, height, dpr);
                } else {
                    log::warn!("AppController - resize failed - no GraphicsContext");
                }
            }
            Err(_) => {
                log::warn!("AppController: resize failed - GraphicsContext is borrowed");
            }
        };
    }
}

impl AppController {
    pub fn new(renderer: WgpuRenderer) -> Self {
        let event_loop = EventLoop::new().unwrap();
        let window = WindowBuilder::new().build(&event_loop).unwrap();

        let inner = AppControllerInner {
            renderer: renderer.clone(),
            window,
            event_loop: RefCell::new(Some(event_loop)),
            state: RefCell::new(State {
                frame_listener_next_idx: 0,
                frame_listeners: Vec::new(),
            }),
            js_listeners: RefCell::new(Vec::new()),
        };

        let me = Self(Rc::new(inner));
        me.init_listeners(renderer);

        me
    }

    fn init_listeners(&self, renderer: WgpuRenderer) {
        let window = web_sys::window().expect("no global `window` exists");
        let doc1 = window.document().expect("should have a document on window");
        let doc2 = doc1.clone();

        let visibilitychange_callback = Closure::<dyn FnMut()>::new(move || {
            log::warn!("shohei - visibilitychange");
            if doc1.visibility_state() == web_sys::VisibilityState::Visible {
                renderer.conditionally_init_context();
            }
        });

        self.0.js_listeners.borrow_mut().push(JsEventListener::new(
            doc2,
            "visibilitychange",
            visibilitychange_callback,
        ));
    }

    pub fn conditionally_init_context(&self) {
        self.renderer.conditionally_init_context()
    }

    pub fn redraw(&self) {
        self.window.request_redraw();
    }

    pub fn subscribe_frame(
        &self,
        listener: impl FnMut() -> SubscriptionState + 'static,
    ) -> ListenerId {
        let mut state = self.state.borrow_mut();
        let listener_id = state.frame_listener_next_idx;

        state.frame_listener_next_idx += 1;
        state
            .frame_listeners
            .push((listener_id, Box::new(listener)));

        listener_id
    }

    pub fn unsubscribe_frame(&self, listener_id: ListenerId) {
        let mut state = self.state.borrow_mut();
        state.frame_listeners.retain(|(id, _)| *id != listener_id);
    }
}
