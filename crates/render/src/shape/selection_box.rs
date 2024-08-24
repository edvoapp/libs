//! Create a selection box.
//!
//! Specifically, a selection box is a rectangle with four corner nodes like the following:
//!
//! ```text
//!  □-----------------□
//!  |                 |
//!  |                 |
//!  |                 |
//!  |                 |
//!  |                 |
//!  □-----------------□
//! ```
//!
//! Please also refer to [PLM-1493](https://edvo.atlassian.net/browse/PLM-1493) for more accurate visual information.
//!
//! [`selection_box`] returns two [`PathElement`]s: one for the fill and one for the stroke.
//!
//! The order of operations is as follows:
//! 0. Create a path for hit testing.
//! 1. Create sides of the selection box.
//! 2. Create corner nodes of the selection box.
//! 3. Create a path for the fill.
//! 4. Create a path for the stroke.

use super::{add_rectangle_helper, Frame};
use crate::util::path::PathElement;
use lyon::{
    lyon_tessellation::{FillOptions, StrokeOptions},
    math::point,
    path::{path::BuilderImpl, traits::Build, Path},
};

type HitPath = Path;

const BORDER_COLOR: [f32; 4] = [33.0 / 255.0, 99.0 / 255.0, 235.0 / 255.0, 1.0];
const INNER_COLOR: [f32; 4] = [1.0; 4]; // inner color of corner nodes
const ACTUAL_BORDER_WIDTH: f32 = 12.0; // important for hit testing
const BORDER_WIDTH: f32 = 2.0;
const CORNER_NODE_WH: f32 = 12.0; // width and height of corner nodes

#[allow(clippy::too_many_arguments)]
pub fn selection_box(left: f32, top: f32, right: f32, bottom: f32) -> ([PathElement; 2], HitPath) {
    // Let's create new left, top, right, and bottom coordinates.
    // These values are just middle points of the four sides of the
    // selection box.
    let translation = BORDER_WIDTH / 2.0;
    let left = left - translation;
    let top = top - translation;
    let right = right + translation;
    let bottom = bottom + translation;

    // 0. Create a path for hit testing.
    let offset = ACTUAL_BORDER_WIDTH / 2.0;
    let l = left + offset;
    let t = top + offset;
    let r = right - offset;
    let b = bottom - offset;
    let hit_path = Frame::new(l, t, r - l, b - t, ACTUAL_BORDER_WIDTH, [0.0; 4]).into();

    // 1. Create a path for the sides of the selection box.
    let sides = sides_path(left, top, right, bottom, CORNER_NODE_WH / 2.0);

    // Offset amoount to the upper left of the corner node.
    let offset = (CORNER_NODE_WH - BORDER_WIDTH) / 2.0;

    // Take the upper left corner node as an example,
    //  - min_l is the left coordinate of the upper left corner node
    //  - min_t is the top coordinate of the upper left corner node
    //  - min_r is the right coordinate of the upper left corner node
    //  - min_b is the bottom coordinate of the upper left corner node
    let min_l = left - offset;
    let min_t = top - offset;
    let min_r = left + offset;
    let min_b = top + offset;

    // Similarly, take the lower right corner node as an example,
    //  - max_l is the left coordinate of the lower right corner node
    //  - max_t is the top coordinate of the lower right corner node
    //  - max_r is the right coordinate of the lower right corner node
    //  - max_b is the bottom coordinate of the lower right corner node
    let max_l = right - offset;
    let max_t = bottom - offset;
    let max_r = right + offset;
    let max_b = bottom + offset;

    // 2. Create a path for the corner nodes of the selection box.
    let ul_cn = add_rectangle_helper(min_l, min_t, min_r, min_b); // upper left corner node
    let ur_cn = add_rectangle_helper(max_l, min_t, max_r, min_b); // upper right corner node
    let lr_cn = add_rectangle_helper(max_l, max_t, max_r, max_b); // lower right corner node
    let ll_cn = add_rectangle_helper(min_l, max_t, min_r, max_b); // lower left corner node

    let stroke_opt = StrokeOptions::default().with_line_width(BORDER_WIDTH);
    let fill_opt = FillOptions::default();

    // 3. Create a path for the fill.
    let mut fill_path_builder = BuilderImpl::new();
    fill_path_builder.extend_from_paths(&[
        ul_cn.clone().as_slice(),
        ur_cn.clone().as_slice(),
        lr_cn.clone().as_slice(),
        ll_cn.clone().as_slice(),
    ]);

    // 4. Create a path for the stroke.
    let mut stroke_path_builder = BuilderImpl::new();
    stroke_path_builder.extend_from_paths(&[
        ul_cn.as_slice(),
        ur_cn.as_slice(),
        lr_cn.as_slice(),
        ll_cn.as_slice(),
        sides.as_slice(),
    ]);

    (
        [
            PathElement::create(
                fill_path_builder.build(),
                INNER_COLOR,
                true,
                Some(fill_opt),
                None,
            ),
            PathElement::create(
                stroke_path_builder.build(),
                BORDER_COLOR,
                false,
                None,
                Some(stroke_opt),
            ),
        ],
        hit_path,
    )
}

/// Creates a contiguous path of the four sides of a rectangle with a given offset.
///
/// Sides of selection box, not including corner nodes.
///
/// ```text
///  □-----------------□
///  |        ^        |
///  |        |        |
///  | <- this part -> |
///  |        |        |
///  |        v        |
///  □-----------------□
/// ```
///
/// Assuming that ◻︎ is a square, the offset is half of the width of ◻︎.
/// So, if the offset is 0.0, then the path will be a rectangle.
pub fn sides_path(l: f32, t: f32, r: f32, b: f32, offset: f32) -> Path {
    let lwo = l + offset; // left with offset
    let two = t + offset; // top with offset
    let rwo = r - offset; // right with offset
    let bwo = b - offset; // bottom with offset

    let mut builder = Path::builder();

    // Top side
    builder.begin(point(lwo, t));
    builder.line_to(point(rwo, t));
    builder.end(false);

    // Right side
    builder.begin(point(r, two));
    builder.line_to(point(r, bwo));
    builder.end(false);

    // Bottom side
    builder.begin(point(rwo, b));
    builder.line_to(point(lwo, b));
    builder.end(false);

    // Left side
    builder.begin(point(l, bwo));
    builder.line_to(point(l, two));
    builder.end(false);

    builder.build()
}
