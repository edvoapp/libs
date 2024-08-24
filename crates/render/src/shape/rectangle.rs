//! Create a rectangle [`Path`] with [`lyon::tessellation::path::builder::PathBuilder::add_rectangle`].

use lyon::{
    geom::{point, Box2D},
    path::Path,
};

/// Helper function for [`lyon::tessellation::path::builder::PathBuilder::add_rectangle`].
pub fn add_rectangle_helper(l: f32, t: f32, r: f32, b: f32) -> Path {
    let mut builder = Path::builder();
    builder.add_rectangle(
        &Box2D::new(point(l, t), point(r, b)),
        lyon::path::Winding::Positive,
    );
    builder.build()
}
