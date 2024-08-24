use super::BufferRecord;
use normalize_css_z::normalize;

#[repr(C)]
#[derive(Copy, Clone, Debug, bytemuck::Pod, bytemuck::Zeroable)]
pub struct Position {
    pub position: [f32; 2],
    pub z: f32,
    pub hovered: f32,
    pub scaling_vec: [f32; 2],
}

impl Position {
    const ATTRIBUTES: &'static [wgpu::VertexAttribute; 4] = &wgpu::vertex_attr_array![
        2 => Float32x2,
        3 => Float32,
        4 => Float32,
        5 => Float32x2,
    ];
    pub fn from_xyz(x: f32, y: f32, z: i32, sx: f32, sy: f32) -> Self {
        Self {
            position: [x, y],
            z: normalize(z).unwrap_or_default(),
            hovered: 0.0,
            scaling_vec: [sx, sy],
        }
    }
    pub fn from_xyz_foo(x: f32, y: f32, z: f32, sx: f32, sy: f32) -> Self {
        Self {
            position: [x, y],
            z,
            hovered: 0.0,
            scaling_vec: [sx, sy],
        }
    }
}

impl Default for Position {
    fn default() -> Self {
        Self {
            position: [0.0, 0.0],
            z: 1.0,
            hovered: 0.0,
            scaling_vec: [1.0, 1.0],
        }
    }
}

impl BufferRecord for Position {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a> {
        use std::mem;
        wgpu::VertexBufferLayout {
            array_stride: mem::size_of::<Position>() as wgpu::BufferAddress,
            step_mode: wgpu::VertexStepMode::Instance,
            attributes: Self::ATTRIBUTES,
        }
    }
}
