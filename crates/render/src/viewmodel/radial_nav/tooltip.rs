use crate::model::{Position, PositionColor};
use crate::modules::PositionedRenderModule;
use crate::svg::Svg;

use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(js_name = VM_Tooltip)]
pub struct Tooltip {
    render_module: Rc<PositionedRenderModule<PositionColor, Position>>,
}

#[wasm_bindgen(js_class = VM_Tooltip)]
impl Tooltip {
    pub fn new(icon: Svg) -> Self {
        Tooltip {
            render_module: icon.into_rendermodule(),
        }
    }

    pub fn update(&self, x: f32, y: f32) {
        self.render_module.update_instances(
            &[Position {
                position: [x, y],
                z: 0.0,
                hovered: 0.0,
                scaling_vec: [1.0, 1.0],
            }],
            None,
        );
    }
}
