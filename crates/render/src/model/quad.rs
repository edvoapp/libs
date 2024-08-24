/// The pupose of this model is to box the target shader object so that it becomes
/// visible within the quadrangle.
/// It is important to note that `wgpu::PrimitiveTopology::TriangleStrip` must be
/// used for this to work, unless you intend to extend this model.
use super::BufferRecord;

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable, Default)]
pub struct QuadVertex {
    pub position: [f32; 2],
    pub color: [f32; 4],
}

impl QuadVertex {
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
pub struct Quad {
    left: f32,
    top: f32,
    width: f32,
    height: f32,
    color: [f32; 4],
}

impl Quad {
    pub const INDICES: [u16; 4] = [0, 1, 3, 2];
    pub fn origin(width: f32, height: f32) -> Self {
        Self {
            left: 0.0,
            top: 0.0,
            width,
            height,
            color: [0.0; 4],
        }
    }
    pub fn new(left: f32, top: f32, width: f32, height: f32, color: [f32; 4]) -> Self {
        Self {
            left,
            top,
            width,
            height,
            color,
        }
    }
    fn right(&self) -> f32 {
        self.left + self.width
    }
    fn bottom(&self) -> f32 {
        self.top + self.height
    }
}

impl From<Quad> for ([QuadVertex; 1], [u16; 1]) {
    fn from(_value: Quad) -> Self {
        ([QuadVertex::new(0.0, 0.0, [0.0; 4])], [0])
    }
}

impl From<Quad> for ([QuadVertex; 4], [u16; 4]) {
    fn from(value: Quad) -> Self {
        (
            [
                QuadVertex::new(value.left, value.top, value.color),
                QuadVertex::new(value.right(), value.top, value.color),
                QuadVertex::new(value.right(), value.bottom(), value.color),
                QuadVertex::new(value.left, value.bottom(), value.color),
            ],
            Quad::INDICES,
        )
    }
}

impl BufferRecord for QuadVertex {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        use std::mem;
        wgpu::VertexBufferLayout {
            array_stride: mem::size_of::<QuadVertex>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: &Self::ATTRIBUTES,
        }
    }
}
