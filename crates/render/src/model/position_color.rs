use super::BufferRecord;

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct PositionColor {
    pub position: [f32; 2],
    pub color: [f32; 4],
}

impl PositionColor {
    const ATTRIBUTES: &'static [wgpu::VertexAttribute; 2] =
        &wgpu::vertex_attr_array![0 => Float32x2, 1 => Float32x4];
}

impl Default for PositionColor {
    fn default() -> Self {
        Self {
            position: [0.0, 0.0],
            color: [0.0; 4],
        }
    }
}

impl From<PositionColor> for ([PositionColor; 1], [u16; 1]) {
    fn from(value: PositionColor) -> Self {
        ([value], [0])
    }
}

impl BufferRecord for PositionColor {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        wgpu::VertexBufferLayout {
            array_stride: std::mem::size_of::<PositionColor>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Vertex,
            attributes: Self::ATTRIBUTES,
        }
    }
}
