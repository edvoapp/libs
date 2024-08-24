mod null;
mod position;
mod position_color;
mod quad;

pub use null::*;
pub use position::*;
pub use position_color::*;
pub use quad::*;

/// This module contains render data model objects which are used to create render
/// buffers.

pub trait BufferRecord: bytemuck::Pod {
    fn desc<'a>() -> wgpu::VertexBufferLayout<'a>;
}
