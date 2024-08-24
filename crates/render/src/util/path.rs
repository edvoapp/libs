/// This render module simply renders a group of vertex indexes with basic position
/// and size instance data.
use crate::model::{BufferRecord, PositionColor};
use crate::modules::{PositionedRenderModule, Update};

use lyon::lyon_tessellation::{
    BuffersBuilder, FillOptions, FillTessellator, FillVertex, StrokeOptions, StrokeTessellator,
    StrokeVertex, VertexBuffers,
};
use lyon::path::Path;

#[derive(Clone)]
pub enum PathElement {
    Stroke {
        path: Path,
        opt: StrokeOptions,
        color: [f32; 4],
    },
    Fill {
        path: Path,
        opt: FillOptions,
        color: [f32; 4],
    },
}

impl Default for PathElement {
    fn default() -> Self {
        Self::Fill {
            path: Path::new(),
            opt: Default::default(),
            color: [0.0; 4],
        }
    }
}

impl PathElement {
    pub fn create(
        path: Path,
        color: [f32; 4],
        is_fill: bool,
        fill_opt: Option<FillOptions>,
        stroke_opt: Option<StrokeOptions>,
    ) -> Self {
        if is_fill {
            PathElement::Fill {
                path,
                opt: fill_opt.unwrap_or_default(),
                color,
            }
        } else {
            PathElement::Stroke {
                path,
                opt: stroke_opt.unwrap_or_default(),
                color,
            }
        }
    }
}

/// This trait allows you to updated a `PositionedRenderModule` with an iterator of
/// `PathElement`s.
/// We implemented it as a singleton trait in the interest of hygiene.
pub trait PathRender {
    fn update_path<P: IntoIterator<Item = PathElement>>(&self, paths: P);
}

impl<I> PathRender for PositionedRenderModule<PositionColor, I>
where
    I: BufferRecord,
{
    fn update_path<P: IntoIterator<Item = PathElement>>(&self, paths: P) {
        // TODO: Figure out a way to reduce the allocing here because our
        // vertex/index buffers are redundant to `geometry`.
        let mut vertex_buffers = VertexBuffers::<PositionColor, u16>::new();
        let mut fill_tess = FillTessellator::new();
        let mut stroke_tess = StrokeTessellator::new();

        for element in paths.into_iter() {
            match element {
                PathElement::Fill { path, color, opt } => {
                    let tess_res = fill_tess.tessellate_path(
                        &path,
                        &opt,
                        &mut BuffersBuilder::new(&mut vertex_buffers, |vertex: FillVertex| {
                            PositionColor {
                                position: [vertex.position().x, vertex.position().y],
                                color,
                            }
                        }),
                    );
                    if let Err(err) = tess_res {
                        log::error!("Error tessellating fill path: {err:?}");
                        return;
                    }
                }
                PathElement::Stroke { path, color, opt } => {
                    let tess_res = stroke_tess.tessellate_path(
                        &path,
                        &opt,
                        &mut BuffersBuilder::new(&mut vertex_buffers, |vertex: StrokeVertex| {
                            PositionColor {
                                position: [vertex.position().x, vertex.position().y],
                                color,
                            }
                        }),
                    );
                    if let Err(err) = tess_res {
                        log::error!("Error tessellating stroke path: {err:?}");
                        return;
                    }
                }
            }
        }

        self.update(&vertex_buffers);
    }
}

impl<'a, V: 'a> From<&'a VertexBuffers<V, u16>> for Update<'a, V> {
    fn from(value: &'a VertexBuffers<V, u16>) -> Self {
        Self {
            vertices: &value.vertices,
            indices: &value.indices,
        }
    }
}
