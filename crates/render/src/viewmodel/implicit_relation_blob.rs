use crate::model::{Position, PositionColor};
use crate::modules::{PositionedRenderModule, RenderModuleConfigBuilder, Sentinel};
use crate::util::math::lerp;
use crate::util::path::{PathElement, PathRender};

use std::rc::Rc;

use edvo_viewmodel::boundingbox::BoundingBox;
use lyon::math::point as lyon_point;
use lyon::path::Path;
use wasm_bindgen::prelude::*;
use wgpu::BlendState;

#[wasm_bindgen(js_name = VM_ImplicitRelationBlob)]
pub struct ImplicitRelationBlob {
    render_module: Rc<PositionedRenderModule<PositionColor, Position>>,
    path: Option<Path>,
}

#[wasm_bindgen(js_class = VM_ImplicitRelationBlob)]
impl ImplicitRelationBlob {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        let render_module = PositionedRenderModule::new(
            RenderModuleConfigBuilder::new()
                .with_name("implicit")
                .with_blend(Some(BlendState::ALPHA_BLENDING))
                .build(),
        );
        render_module.update_instances(&[Position::default()], None);

        Self {
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
        src_x1: f32,
        src_y1: f32,
        src_x2: f32,
        src_y2: f32,
        dest_x1: f32,
        dest_y1: f32,
        dest_x2: f32,
        dest_y2: f32,
        color: &[f32],
        z_index: i32,
        clip_left: Option<f32>,
        clip_top: Option<f32>,
        clip_width: Option<f32>,
        clip_height: Option<f32>,
    ) {
        let path = create_blob_path(
            (src_x1, src_y1),
            (src_x2, src_y2),
            (dest_x1, dest_y1),
            (dest_x2, dest_y2),
            color,
        );
        let color = [color[0] / 255.0, color[1] / 255.0, color[2] / 255.0, 0.1];
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
        )
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

#[allow(clippy::too_many_arguments)]
pub fn create_blob_path(
    src1: (f32, f32),
    src2: (f32, f32),
    dest1: (f32, f32),
    dest2: (f32, f32),
    _color: &[f32],
) -> Path {
    let mut builder = Path::builder();

    //  p0 ~~~~~    m1   ~~~~~ p1
    //   |      \       /      |
    //   |        ~~~~~        |
    //   |                     |
    //  c1                     c2
    //   |                     |
    //   |        ~~~~~        |
    //   |      /       \      |
    //  p3 ~~~~~   m2   ~~~~~ p2

    let p0 = lyon_point(src1.0, src1.1);
    let p1 = lyon_point(dest1.0, dest1.1);
    let p2 = lyon_point(dest2.0, dest2.1);
    let p3 = lyon_point(src2.0, src2.1);

    // let center = lyon_point((p0.x + p1.x + p2.x + p3.x) / 4.0, (p0.y + p1.y + p2.y + p3.y) / 4.0);

    // center points of each side
    let c1 = lyon_point((p0.x + p3.x) / 2.0, (p0.y + p3.y) / 2.0);
    let c2 = lyon_point((p1.x + p2.x) / 2.0, (p1.y + p2.y) / 2.0);

    // Mid points of each length
    let m1 = lyon_point((p0.x + p1.x) / 2.0, (p0.y + p1.y) / 2.0);
    let m2 = lyon_point((p2.x + p3.x) / 2.0, (p2.y + p3.y) / 2.0);

    let len = f32::sqrt(f32::powf(c1.x - c2.x, 2.0) + f32::powf(c1.y - c2.y, 2.0));

    // Stretch factor from 0 - 1;
    let stretch = f32::min(1.0, len / 210.0);

    // adjust control points based on stretch factor
    let ctrl1 = lyon_point(lerp(m1.x, m2.x, stretch), lerp(m1.y, m2.y, stretch));
    let ctrl2 = lyon_point(lerp(m2.x, m1.x, stretch), lerp(m2.y, m1.y, stretch));

    // Trapezoid blob
    builder.begin(p0);

    builder.quadratic_bezier_to(ctrl1, p1);
    // builder.line_to(centerpoint);
    builder.line_to(p2);
    // builder.line_to(p3);

    builder.quadratic_bezier_to(ctrl2, p3);
    builder.close();

    builder.build()
}
