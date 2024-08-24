use crate::model::Position;
use crate::modules::{PositionedRenderModule, RenderModuleConfigBuilder, Sentinel};
use crate::shape::frame::{Frame, FrameVertex};
use crate::util::types::ObjectKind;

use edvo_viewmodel::boundingbox::BoundingBox;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = Border)]
pub struct Border {
    render_module: Rc<PositionedRenderModule<FrameVertex, Position>>,
}

#[wasm_bindgen(js_class = Border)]
impl Border {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        let render_module = PositionedRenderModule::new(
            RenderModuleConfigBuilder::new()
                .with_topology(wgpu::PrimitiveTopology::TriangleStrip)
                .with_name("border")
                .with_kind(ObjectKind::Frame)
                .build(),
        );

        Self { render_module }
    }

    pub fn sentinel(&self) -> Sentinel {
        Sentinel::new(&self.render_module)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update(
        &mut self,
        left: f32,
        top: f32,
        width: f32,
        height: f32,
        z_index: i32,
        clip_left: Option<f32>,
        clip_top: Option<f32>,
        clip_width: Option<f32>,
        clip_height: Option<f32>,
        border_width: f32,
    ) {
        let color = [33.0 / 255.0, 99.0 / 255.0, 235.0 / 255.0, 1.0];
        let frame: ([FrameVertex; 8], [u16; 10]) =
            Frame::new(left, top, width, height, border_width, color).into();

        self.render_module.update(&frame);
        self.render_module.update_instances(
            &[Position::from_xyz(0.0, 0.0, z_index, 1.0, 1.0)],
            match (clip_left, clip_top, clip_width, clip_height) {
                (Some(clip_left), Some(clip_top), Some(clip_width), Some(clip_height)) => Some(
                    BoundingBox::from_xyhw(clip_left, clip_top, clip_height, clip_width),
                ),
                _ => None,
            },
        );
    }
}
