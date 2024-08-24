use crate::model::{Position, PositionColor};
use crate::modules::{PositionedRenderModule, RenderModuleConfigBuilder, Sentinel};
use crate::util::path::{PathElement, PathRender};

use std::rc::Rc;

use edvo_viewmodel::boundingbox::BoundingBox;
use lyon::math::point as lyon_point;
use lyon::path::Path as LyonPath;
use wasm_bindgen::prelude::*;

const ARROW_HEAD_HEIGHT: f32 = 10.0;
const ARROW_HEAD_BASE: f32 = 8.0;
const LINE_WIDTH: f32 = 2.0;

#[wasm_bindgen(js_name = VM_Arrow)]
pub struct Arrow {
    render_module: Rc<PositionedRenderModule<PositionColor, Position>>,
    path: Option<LyonPath>,
}

#[wasm_bindgen(js_class = VM_Arrow)]
impl Arrow {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        let render_module = PositionedRenderModule::new(
            RenderModuleConfigBuilder::new().with_name("arrow").build(),
        );
        render_module.update_instances(&[Position::default()], None);
        Arrow {
            render_module,
            path: None,
        }
    }

    pub fn sentinel(&self) -> Sentinel {
        Sentinel::new(&self.render_module)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn update(
        &mut self,
        src_x: f32,
        src_y: f32,
        dest_x: f32,
        dest_y: f32,
        color: &[f32],
        z_index: i32,
        clip_left: Option<f32>,
        clip_top: Option<f32>,
        clip_width: Option<f32>,
        clip_height: Option<f32>,
    ) {
        let path = straight_arrow_path(src_x, src_y, dest_x, dest_y, color);
        let color = [color[0] / 255.0, color[1] / 255.0, color[2] / 255.0, 1.0];
        self.path = Some(path.clone());
        self.render_module.update_path([PathElement::Fill {
            path,
            color,
            opt: Default::default(),
        }]);
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

pub fn straight_arrow_path(
    src_x: f32,
    src_y: f32,
    dest_x: f32,
    dest_y: f32,
    _color: &[f32],
) -> LyonPath {
    let d = ((dest_x - src_x) * (dest_x - src_x) + (dest_y - src_y) * (dest_y - src_y)).sqrt();
    let unit_vector = [(dest_x - src_x) / d, (dest_y - src_y) / d];

    let mut builder = LyonPath::builder();

    // Default width for now; distance between `p0` and `p6`
    // and distance between `p1` and `p5`.
    let arrow_head_height = ARROW_HEAD_HEIGHT; // distance between `p` and `p3`
    let arrow_head_base = ARROW_HEAD_BASE; // distance b/w `p2` and `p4`
    let line_width = LINE_WIDTH;

    let dx0 = (line_width / 2.0) * unit_vector[1];
    let dy0 = (line_width / 2.0) * unit_vector[0];

    let dx1 = (arrow_head_base / 2.0) * unit_vector[1];
    let dy1 = (arrow_head_base / 2.0) * unit_vector[0];

    // Center point of `p1` and `p5`.
    let p = [
        dest_x - unit_vector[0] * arrow_head_height,
        dest_y - unit_vector[1] * arrow_head_height,
    ];

    //                  p2
    //                  |\
    //  p0            p1| \
    //    ---------------  \ p3
    //    |            p•  /
    //    --------------| /
    //  p6            p5|/
    //                  p4

    let p0 = lyon_point(src_x + dx0, src_y - dy0);
    let p1 = lyon_point(p[0] + dx0, p[1] - dy0);
    let p2 = lyon_point(p[0] + dx1, p[1] - dy1);
    let p3 = lyon_point(dest_x, dest_y); // pointy part of arrow
    let p4 = lyon_point(p[0] - dx1, p[1] + dy1);
    let p5 = lyon_point(p[0] - dx0, p[1] + dy0);
    let p6 = lyon_point(src_x - dx0, src_y + dy0);

    // let cx = (p0.x + p1.x) / 3.0;
    // let c1 = lyon_point(cx, p0.y - 0.5);
    // let c2 = lyon_point(2.0 * cx, p0.y + 0.5);
    // let c3 = lyon_point(2.0 * cx, p6.y + 0.5);
    // let c4 = lyon_point(cx, p6.y - 0.5);

    builder.begin(p0);
    // builder.cubic_bezier_to(c1, c2, p1);
    builder.cubic_bezier_to(p1, p0, p1);
    builder.line_to(p2);
    builder.line_to(p3);
    builder.line_to(p4);
    builder.line_to(p5);
    // builder.cubic_bezier_to(c3, c4, p6);
    builder.cubic_bezier_to(p6, p5, p6);
    builder.close();

    builder.build()
}
