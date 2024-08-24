use crate::model::{Position, PositionColor};
use crate::modules::{PositionedRenderModule, RenderModuleConfigBuilder};
use crate::util::types::ObjectKind;

use std::rc::Rc;
use std::str::FromStr;

use lyon::lyon_tessellation::{
    self as tessellation, BuffersBuilder, FillOptions, FillTessellator, FillVertex, StrokeOptions,
    StrokeTessellator, StrokeVertex, VertexBuffers,
};
use lyon::math::Point;
use lyon::path::PathEvent;
use usvg::PathSegmentsIter;
use wasm_bindgen::prelude::*;

const FALLBACK_COLOR: usvg::Color = usvg::Color {
    red: 0,
    green: 0,
    blue: 0,
};

#[wasm_bindgen]
pub struct Svg {
    pub(crate) mesh: VertexBuffers<PositionColor, u16>,
}

impl Svg {
    pub fn new(svg_data: &'static [u8], _size: (usize, usize)) -> Self {
        let mut fill_tess = FillTessellator::new();
        let mut stroke_tess = StrokeTessellator::new();
        let mut mesh: VertexBuffers<PositionColor, u16> = VertexBuffers::new();

        let opt = usvg::Options::default();
        let rtree = usvg::Tree::from_data(svg_data, &opt).unwrap();

        // These offset values are needed in order to center the SVG.
        let offset_x = (rtree.size.width() / 2.0) as f32;
        let offset_y = (rtree.size.height() / 2.0) as f32;

        // TODO - back out the positioning and move that to the update step somehow ( either uniform argument to a single render pipeline call or some other way )
        for node in rtree.root.descendants() {
            if let usvg::NodeKind::Path(ref p) = *node.borrow() {
                if let Some(ref fill) = p.fill {
                    // fall back to always use color fill
                    // no gradients (yet?)
                    let color = match fill.paint {
                        usvg::Paint::Color(c) => {
                            let usvg::Color { red, green, blue } = c;
                            [
                                red as f32 / 255.0,
                                green as f32 / 255.0,
                                blue as f32 / 255.0,
                                1.0,
                            ]
                        }
                        _ => [0.0, 0.0, 0.0, 1.0], // fallback color
                    };

                    fill_tess
                        .tessellate(
                            convert_path(p),
                            &FillOptions::tolerance(0.01),
                            &mut BuffersBuilder::new(&mut mesh, |vertex: FillVertex| {
                                PositionColor {
                                    position: [
                                        vertex.position().x - offset_x,
                                        vertex.position().y - offset_y,
                                    ],
                                    color,
                                }
                            }),
                        )
                        .expect("Error during tesselation!");
                }

                if let Some(ref stroke) = p.stroke {
                    let (stroke_color, stroke_opts) = convert_stroke(stroke);
                    let usvg::Color { red, green, blue } = stroke_color;
                    let color = [
                        red as f32 / 255.0,
                        green as f32 / 255.0,
                        blue as f32 / 255.0,
                        1.0,
                    ];
                    let _ = stroke_tess.tessellate(
                        convert_path(p),
                        &stroke_opts.with_tolerance(0.01),
                        &mut BuffersBuilder::new(&mut mesh, |vertex: StrokeVertex| PositionColor {
                            position: [
                                vertex.position().x - offset_x,
                                vertex.position().y - offset_y,
                            ],
                            color,
                        }),
                    );
                }
            }
        }

        Self { mesh }
    }

    pub fn into_rendermodule(self) -> Rc<PositionedRenderModule<PositionColor, Position>> {
        let render_module = PositionedRenderModule::new(
            RenderModuleConfigBuilder::new()
                .with_name("svg")
                .with_kind(ObjectKind::Svg)
                .with_depth_write_enabled(false)
                .build(),
        );
        render_module.update(&self.mesh);
        render_module
    }
}

//
// Some glue between usvg's iterators and lyon's.
//
struct PathConvIter<'a> {
    iter: PathSegmentsIter<'a>,
    prev: Point,
    first: Point,
    needs_end: bool,
    deferred: Option<PathEvent>,
}

impl<'l> Iterator for PathConvIter<'l> {
    type Item = PathEvent;
    fn next(&mut self) -> Option<PathEvent> {
        if self.deferred.is_some() {
            return self.deferred.take();
        }

        let next = self.iter.next();
        match next {
            Some(usvg::PathSegment::MoveTo { x, y }) => {
                if self.needs_end {
                    let last = self.prev;
                    let first = self.first;
                    self.needs_end = false;
                    self.prev = point(&x, &y);
                    self.deferred = Some(PathEvent::Begin { at: self.prev });
                    self.first = self.prev;
                    Some(PathEvent::End {
                        last,
                        first,
                        close: false,
                    })
                } else {
                    self.first = point(&x, &y);
                    self.needs_end = true;
                    Some(PathEvent::Begin { at: self.first })
                }
            }
            Some(usvg::PathSegment::LineTo { x, y }) => {
                self.needs_end = true;
                let from = self.prev;
                self.prev = point(&x, &y);
                Some(PathEvent::Line {
                    from,
                    to: self.prev,
                })
            }
            Some(usvg::PathSegment::CurveTo {
                x1,
                y1,
                x2,
                y2,
                x,
                y,
            }) => {
                self.needs_end = true;
                let from = self.prev;
                self.prev = point(&x, &y);
                Some(PathEvent::Cubic {
                    from,
                    ctrl1: point(&x1, &y1),
                    ctrl2: point(&x2, &y2),
                    to: self.prev,
                })
            }
            Some(usvg::PathSegment::ClosePath) => {
                self.needs_end = false;
                self.prev = self.first;
                Some(PathEvent::End {
                    last: self.prev,
                    first: self.first,
                    close: true,
                })
            }
            None => {
                if self.needs_end {
                    self.needs_end = false;
                    let last = self.prev;
                    let first = self.first;
                    Some(PathEvent::End {
                        last,
                        first,
                        close: false,
                    })
                } else {
                    None
                }
            }
        }
    }
}

fn point(x: &f64, y: &f64) -> Point {
    Point::new((*x) as f32, (*y) as f32)
}

fn convert_path(p: &usvg::Path) -> PathConvIter {
    PathConvIter {
        iter: p.data.segments(),
        first: Point::new(0.0, 0.0),
        prev: Point::new(0.0, 0.0),
        deferred: None,
        needs_end: false,
    }
}

fn convert_stroke(s: &usvg::Stroke) -> (usvg::Color, StrokeOptions) {
    let color = match s.paint {
        usvg::Paint::Color(c) => c,
        _ => FALLBACK_COLOR,
    };
    let linecap = match s.linecap {
        usvg::LineCap::Butt => tessellation::LineCap::Butt,
        usvg::LineCap::Square => tessellation::LineCap::Square,
        usvg::LineCap::Round => tessellation::LineCap::Round,
    };
    let linejoin = match s.linejoin {
        usvg::LineJoin::Miter => tessellation::LineJoin::Miter,
        usvg::LineJoin::Bevel => tessellation::LineJoin::Bevel,
        usvg::LineJoin::Round => tessellation::LineJoin::Round,
    };
    let opt = StrokeOptions::tolerance(0.01)
        .with_line_width(s.width.get() as f32)
        .with_line_cap(linecap)
        .with_line_join(linejoin);

    (color, opt)
}

impl FromStr for Svg {
    type Err = ();
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "search" => Ok(Svg::new(
                include_bytes!("../../../assets/icons/search.svg"),
                (48, 48),
            )),
            "note" => Ok(Svg::new(
                include_bytes!("../../../assets/icons/note.svg"),
                (48, 48),
            )),
            "sticky" => Ok(Svg::new(
                include_bytes!("../../../assets/icons/sticky.svg"),
                (48, 48),
            )),
            "browser" => Ok(Svg::new(
                include_bytes!("../../../assets/icons/browser.svg"),
                (48, 48),
            )),
            "portal" => Ok(Svg::new(
                include_bytes!("../../../assets/icons/portal.svg"),
                (48, 48),
            )),
            _ => Err(()),
        }
    }
}
