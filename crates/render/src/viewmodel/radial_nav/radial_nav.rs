use crate::get_app_controller;
use crate::model::{BufferRecord, Quad, QuadVertex};
use crate::modules::{PositionedRenderModule, RenderModuleConfigBuilder, Sentinel};
use crate::util::animator::Animator;
use crate::util::math::lerp;
use crate::util::types::ObjectKind;
use crate::wgpu_renderer::SubscriptionState;

use futures::channel::oneshot::{self, Canceled};
use wasm_bindgen::prelude::*;
use wgpu::include_wgsl;

use std::cell::RefCell;
use std::rc::Rc;

/// Special buffer record just for RadialNav instancing.
#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable, Default)]
struct RNavInstance {
    ipos: [f32; 2],
    radius: f32,
    presence: f32,
    slice_angle: f32,
    slice_transition: f32,
    target_action: f32,
    segment_width: f32,
    fadein: f32,
}

impl RNavInstance {
    const ATTRIBUTES: [wgpu::VertexAttribute; 8] = wgpu::vertex_attr_array![
        2 => Float32x2,
        3 => Float32,
        4 => Float32,
        5 => Float32,
        6 => Float32,
        7 => Float32,
        8 => Float32,
        9 => Float32
    ];
}

impl BufferRecord for RNavInstance {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        use std::mem;
        wgpu::VertexBufferLayout {
            array_stride: mem::size_of::<RNavInstance>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Instance,
            attributes: &Self::ATTRIBUTES,
        }
    }
}

#[derive(Clone, PartialEq)]
pub enum Appearance {
    Hidden,
    Expanded,
    Collapsed, // default
}

impl Appearance {
    fn radius(&self) -> f32 {
        match self {
            Appearance::Hidden => 0.0,
            Appearance::Expanded => RadialNav::RADIUS_EXPANDED,
            Appearance::Collapsed => RadialNav::RADIUS_COLLAPSED,
        }
    }
}

#[derive(Clone)]
#[wasm_bindgen(js_name = VM_RadialNav)]
pub struct RadialNav(Rc<Inner>);

struct Inner {
    render_module: Rc<PositionedRenderModule<QuadVertex, RNavInstance>>,
    state: RefCell<State>,
}

struct State {
    current_appearance: Appearance,
    appearance_animation: Option<(Animator, oneshot::Sender<bool>)>,
    current_slice: Option<f32>,
    slice_animation: Option<Animator>,
    instance: RNavInstance,
}

#[wasm_bindgen(js_class = VM_RadialNav)]
impl RadialNav {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        let render_module = PositionedRenderModule::new(
            RenderModuleConfigBuilder::new()
                .with_shader_desc(include_wgsl!("../../../shaders/radial_nav.wgsl"))
                .with_blend(Some(wgpu::BlendState {
                    alpha: wgpu::BlendComponent::OVER,
                    color: wgpu::BlendComponent::OVER,
                }))
                .with_topology(wgpu::PrimitiveTopology::TriangleStrip)
                .with_name("radial-nav")
                .with_kind(ObjectKind::RadialNav)
                .build(),
        );

        let width = (Self::RADIUS_EXPANDED + Self::PADDING) * 2.0;
        let height = width;
        let quad: ([QuadVertex; 4], [u16; 4]) = Quad::origin(width, height).into();
        render_module.update(&quad);

        RadialNav(Rc::new(Inner {
            render_module,
            state: RefCell::new(State {
                appearance_animation: None,
                current_appearance: Appearance::Hidden,
                instance: RNavInstance {
                    target_action: -1.0,
                    ..RNavInstance::default()
                },
                current_slice: None,
                slice_animation: None,
            }),
        }))
    }

    pub fn sentinel(&self) -> Sentinel {
        Sentinel::new(&self.0.render_module)
    }

    pub async fn collapsed(&self, x: f32, y: f32, summoned: Option<bool>) -> bool {
        self.animate(Appearance::Collapsed, [x, y], summoned).await
    }

    pub async fn expanded(&self, x: f32, y: f32) -> bool {
        self.animate(Appearance::Expanded, [x, y], None).await
    }

    pub async fn hide(&self, x: f32, y: f32) -> bool {
        self.animate(Appearance::Hidden, [x, y], None).await
    }

    // `angle` in degrees
    pub fn set_hovered_pie_slice_angle(&self, angle: Option<f32>, num_of_actions: u8) {
        {
            let segment_width = 1.0 / (num_of_actions as f32);
            let mut state = self.0.state.borrow_mut();
            state.instance.segment_width = segment_width;
            state.instance.target_action = if let Some(a) = angle {
                into_target_action(a, segment_width)
            } else {
                -1.0
            };
            drop(state);
        }
        self.animate_pie_slice(angle);
    }
}

impl RadialNav {
    const RADIUS_EXPANDED: f32 = 100.0;
    const RADIUS_COLLAPSED: f32 = 40.0;
    const PADDING: f32 = 20.0;

    async fn animate(
        &self,
        mode: Appearance,
        center_point: [f32; 2],
        summoned: Option<bool>,
    ) -> bool {
        // convert from center point to topleft
        let offset = Self::RADIUS_EXPANDED + Self::PADDING;
        let top_left = [center_point[0] - offset, center_point[1] - offset];

        let (sender, receiver) = oneshot::channel::<bool>();
        {
            let mut state = self.0.state.borrow_mut();
            let end = mode.radius();

            // Cancel any current animation.
            let summoned = summoned.unwrap_or(false);
            let start = if summoned {
                0.0
            } else if let Some((animator, sender)) = state.appearance_animation.take() {
                // If we were animating, determine where it was in the animation.
                let current = match &state.current_appearance {
                    &Appearance::Hidden => {
                        Appearance::Collapsed.radius()
                            - Appearance::Collapsed.radius() * animator.current()
                    }
                    _ => state.current_appearance.radius() * animator.current(),
                };
                animator.cancel(); // and then cancel it
                sender.send(false).unwrap(); // and cause the async fn animate to return
                current
            } else {
                state.current_appearance.radius()
            };

            let animator = Animator::new(0.2, 0.0, 1.0);

            let appearing =
                state.current_appearance == Appearance::Hidden && mode != Appearance::Hidden;
            let disappearing =
                state.current_appearance != Appearance::Hidden && mode == Appearance::Hidden;

            // Set the destination mode.
            state.current_appearance = mode.clone();

            // Stash a copy of the animation so we can cancel it if we need to.
            state.appearance_animation = Some((animator.clone(), sender));
            drop(state);

            // Make a copy of `self` so we can update the render instance.
            let me = self.clone();
            get_app_controller().subscribe_frame(move || match animator.step() {
                Some(progress) => {
                    let radius = lerp(start, end, progress);
                    let presence = if appearing {
                        // The more we progress in the animation, the more
                        // "present" we are.
                        progress
                    } else if disappearing {
                        // The more we progress in the animation, the less
                        // "present" we are.
                        1.0 - progress
                    } else if mode == Appearance::Hidden {
                        0.0 // constant non-presence
                    } else {
                        1.0 // constant presence (Eg: collapsed -> expanded)
                    };
                    let mut state = me.0.state.borrow_mut();
                    state.instance = RNavInstance {
                        ipos: top_left,
                        radius,
                        presence,
                        ..state.instance
                    };
                    me.0.render_module.update_instances(&[state.instance], None);
                    SubscriptionState::Continue
                }
                None => {
                    if let Some((_animator, sender)) =
                        me.0.state.borrow_mut().appearance_animation.take()
                    {
                        // Cause the async fn animate to return.
                        sender.send(true).unwrap();
                    }
                    // Cancel our subscription.
                    SubscriptionState::Unsubscribe
                }
            });
        }

        // Wait until the animation has ended OR been canceled.
        match receiver.await {
            Ok(done) => done,
            Err(Canceled) => true,
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    pub fn animate_foo(
        &self,
        mode: Appearance,
        center_point: [f32; 2],
        summoned: Option<bool>,
    ) -> bool {
        let offset = Self::RADIUS_EXPANDED + Self::PADDING;
        let top_left = [center_point[0] - offset, center_point[1] - offset];

        let mut state = self.0.state.borrow_mut();

        let end = mode.radius();
        let summoned = summoned.unwrap_or(false);
        let start = if summoned {
            0.0
        } else {
            state.current_appearance.radius()
        };

        let animator = Animator::new(0.2, 0.0, 1.0);

        let appearing =
            state.current_appearance == Appearance::Hidden && mode != Appearance::Hidden;
        let disappearing =
            state.current_appearance != Appearance::Hidden && mode == Appearance::Hidden;

        state.current_appearance = mode.clone();
        drop(state);

        // Make a copy of `self` so we can update the render instance.
        let me = self.clone();
        get_global_renderer().subscribe_frame(move || match animator.step() {
            Some(progress) => {
                let radius = lerp(start, end, progress);
                let presence = if appearing {
                    // The more we progress in the animation, the more
                    // "present" we are.
                    progress
                } else if disappearing {
                    // The more we progress in the animation, the less
                    // "present" we are.
                    1. - progress
                } else if mode == Appearance::Hidden {
                    0.0 // constant non-presence
                } else {
                    1.0 // constant presence (Eg: collapsed -> expanded)
                };
                let mut state = me.0.state.borrow_mut();
                state.instance = RNavInstance {
                    ipos: top_left,
                    radius,
                    presence,
                    ..state.instance
                };
                me.0.render_module.update_instances(state.instance);
                SubscriptionState::Continue
            }
            None => SubscriptionState::Unsubscribe,
        });

        true
    }

    fn animate_pie_slice(&self, end_angle: Option<f32>) {
        let mut state = self.0.state.borrow_mut();
        let Some(end) = end_angle else {
            state.instance = RNavInstance {
                slice_angle: -1.0,
                slice_transition: 0.0,
                fadein: 1.0,
                ..state.instance
            };
            self.0
                .render_module
                .update_instances(&[state.instance], None);
            return;
        };

        // Cancel any current animation.
        let start = state.current_slice.unwrap_or_else(|| {
            if let Some(ref a) = state.slice_animation {
                let current = a.current();
                // Override the start if we were animating.
                a.cancel();
                current
            } else {
                0.0
            }
        });

        let fadein = if start == end { 1.0 } else { 0.0 };

        let animator = Animator::new(0.2, 0.0, 1.0);

        // Set the destination mode.
        state.current_slice = Some(end);

        state.instance.slice_angle = start / 360.0;

        // Stash a copy of the animation so we can cancel it if we need to.
        state.slice_animation = Some(animator.clone());
        drop(state);

        // Make a copy of `self` so we can update the render instance.
        let me = self.clone();
        get_app_controller().subscribe_frame(move || match animator.step() {
            Some(progress) => {
                // let slice_angle = lerp(start, end, progress);
                let mut state = me.0.state.borrow_mut();
                state.instance = RNavInstance {
                    slice_transition: progress,
                    fadein,
                    ..state.instance
                };
                me.0.render_module.update_instances(&[state.instance], None);
                SubscriptionState::Continue
            }
            None => {
                me.0.state.borrow_mut().appearance_animation.take();
                SubscriptionState::Unsubscribe
            }
        });
    }
}

fn into_target_action(deg: f32, segment_width: f32) -> f32 {
    let frac = deg / 360.0;
    let half_segment_width = segment_width / 2.0;
    if frac > 0.5 {
        1.0 - frac + half_segment_width
    } else {
        -frac + half_segment_width
    }
}
