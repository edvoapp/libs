use crate::model::{Position, PositionColor};
use crate::modules::PositionedRenderModule;
use crate::svg::Svg;

use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = VM_RadialNavButton)]
pub struct RadialNavButton {
    render_module: Rc<PositionedRenderModule<PositionColor, Position>>,
}

#[wasm_bindgen(js_class = VM_RadialNavButton)]
impl RadialNavButton {
    pub fn new(icon: Svg) -> Self {
        RadialNavButton {
            render_module: icon.into_rendermodule(),
        }
    }

    pub fn update(&mut self, x: f32, y: f32, rotation: f32, hovered: Option<bool>) {
        let rad = (rotation - 90.0).to_radians();
        let button_height = 24.0;
        let distance = 100.0 - 10.0 - (button_height / 2.0); // design ref: https://www.figma.com/file/Uh3sOlZnnoObgD2So75EWx/Edvo-Product-Design-Updates---IDS?node-id=698%3A19047&t=10g99yclL4s9hY9K-0
        let hovered = if hovered.unwrap_or(false) { 1.0 } else { 0.0 };

        self.render_module.update_instances(
            &[Position {
                position: [x + distance * (rad).cos(), y + distance * (rad).sin()],
                z: 0.0,
                hovered,
                scaling_vec: [1.0, 1.0],
            }],
            None,
        );
    }
}
