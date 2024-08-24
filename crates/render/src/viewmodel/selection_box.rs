use crate::model::{Position, PositionColor};
use crate::modules::{PositionedRenderModule, RenderModuleConfigBuilder, Sentinel};
use crate::shape::selection_box;
use crate::util::path::PathRender;
use edvo_viewmodel::boundingbox::BoundingBox;

use std::rc::Rc;

use lyon::math::point as lyon_point;
use lyon::path::Path as LyonPath;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = VM_SelectionBox)]
pub struct SelectionBox {
    render_module: Rc<PositionedRenderModule<PositionColor, Position>>,
    path: Option<LyonPath>, // used for hit testing
}

#[wasm_bindgen(js_class = VM_SelectionBox)]
impl SelectionBox {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self {
            render_module: PositionedRenderModule::new(
                RenderModuleConfigBuilder::new()
                    .with_name("selection-bbox")
                    .build(),
            ),
            path: None,
        }
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
    ) {
        // If there are no selected members, then render something small and return early.
        if left == 0.0 && top == 0.0 && width == 0.0 && height == 0.0 && z_index == 0 {
            if self.path.is_none() {
                return;
            }
            self.path = None;
            self.render_module
                .update::<&([PositionColor; 1], [u16; 1])>(&PositionColor::default().into());
            self.render_module
                .update_instances(&[Position::default()], None);
            return;
        }

        let right = left + width;
        let bottom = top + height;

        let ([fill_path_elem, stroke_path_elem], hit_path) =
            selection_box(left, top, right, bottom);

        self.path = Some(hit_path);
        self.render_module
            .update_path([fill_path_elem.clone(), stroke_path_elem.clone()]);
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

    pub fn hit_test(&self, x: f32, y: f32) -> bool {
        match &self.path {
            Some(path) => lyon::algorithms::hit_test::hit_test_path(
                &lyon_point(x, y),
                path,
                lyon::path::FillRule::NonZero,
                10.0,
            ),
            None => false,
        }
    }
}
