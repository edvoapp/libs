use super::BufferRecord;

#[repr(C)]
#[derive(Copy, Clone, Debug, Default, bytemuck::Pod, bytemuck::Zeroable)]
pub struct NullRecord {}

impl NullRecord {}

impl BufferRecord for NullRecord {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        wgpu::VertexBufferLayout {
            array_stride: 0,
            step_mode: wgpu::VertexStepMode::Instance,
            attributes: &[],
        }
    }
}
