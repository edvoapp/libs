use crate::model::BufferRecord;
use lyon::{math::point, path::Path};

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable, Default)]
pub struct FrameVertex {
    pub position: [f32; 2],
    pub color: [f32; 4],
}

impl FrameVertex {
    const ATTRIBUTES: [wgpu::VertexAttribute; 2] =
        wgpu::vertex_attr_array![0 => Float32x2, 1 => Float32x4];
    fn new(x: f32, y: f32, color: [f32; 4]) -> Self {
        Self {
            position: [x, y],
            color,
        }
    }
}

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable, Default)]
pub struct Frame {
    left: f32,
    top: f32,
    width: f32,
    height: f32,
    border_width: f32,
    frame_color: [f32; 4],
}

impl Frame {
    pub fn new(
        left: f32,
        top: f32,
        width: f32,
        height: f32,
        border_width: f32,
        frame_color: [f32; 4],
    ) -> Self {
        Self {
            left,
            top,
            width,
            height,
            border_width,
            frame_color,
        }
    }
    fn right(&self) -> f32 {
        self.left + self.width
    }
    fn bottom(&self) -> f32 {
        self.top + self.height
    }
}

impl From<Frame> for ([FrameVertex; 1], [u16; 1]) {
    fn from(_value: Frame) -> Self {
        ([FrameVertex::new(0.0, 0.0, [0.0; 4])], [0])
    }
}

impl From<Frame> for ([FrameVertex; 8], [u16; 10]) {
    fn from(value: Frame) -> Self {
        let border_width = value.border_width;
        let color = value.frame_color;

        let l_inner = value.left;
        let t_inner = value.top;
        let r_inner = value.right();
        let b_inner = value.bottom();

        let l_outer = l_inner - border_width;
        let t_outer = t_inner - border_width;
        let r_outer = r_inner + border_width;
        let b_outer = b_inner + border_width;

        (
            [
                FrameVertex::new(l_inner, t_inner, color), // 0: (inner) top left
                FrameVertex::new(r_inner, t_inner, color), // 1: (inner) top right
                FrameVertex::new(r_inner, b_inner, color), // 2: (inner) bottom right
                FrameVertex::new(l_inner, b_inner, color), // 3: (inner) bottom left
                FrameVertex::new(l_outer, t_outer, color), // 4: (outer) top left
                FrameVertex::new(r_outer, t_outer, color), // 5: (outer) top right
                FrameVertex::new(r_outer, b_outer, color), // 6: (outer) bottom right
                FrameVertex::new(l_outer, b_outer, color), // 7: (outer) bottom left
            ],
            [0, 4, 1, 5, 2, 6, 3, 7, 0, 4],
        )
    }
}

impl From<Frame> for Path {
    fn from(value: Frame) -> Self {
        let border_width = value.border_width;

        let l_inner = value.left;
        let t_inner = value.top;
        let r_inner = value.right();
        let b_inner = value.bottom();

        let l_outer = l_inner - border_width;
        let t_outer = t_inner - border_width;
        let r_outer = r_inner + border_width;
        let b_outer = b_inner + border_width;

        // 0--------------1,6---7
        // |+++++++++++++++|++++|
        // |++++3----------2++++|
        // |++++|          |++++|
        // |++++|          |++++|
        // |++++|          |++++|
        // |++++4----------5++++|
        // |++++++++++++++++++++|
        // 9--------------------8
        //
        // The '+' indicates the hit area of selection box.
        let mut builder = Path::builder();
        let point_1_and_6 = point(r_inner, t_outer);

        builder.begin(point(l_outer, t_outer)); // 0
        builder.line_to(point_1_and_6); // 1
        builder.line_to(point(r_inner, t_inner)); // 2
        builder.line_to(point(l_inner, t_inner)); // 3
        builder.line_to(point(l_inner, b_inner)); // 4
        builder.line_to(point(r_inner, b_inner)); // 5
        builder.line_to(point_1_and_6); // 6
        builder.line_to(point(r_outer, t_outer)); // 7
        builder.line_to(point(r_outer, b_outer)); // 8
        builder.line_to(point(l_outer, b_outer)); // 9
        builder.close();

        builder.build()
    }
}

impl BufferRecord for FrameVertex {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        use std::mem;
        wgpu::VertexBufferLayout {
            array_stride: mem::size_of::<FrameVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &Self::ATTRIBUTES,
        }
    }
}
