mod positioned;
mod sentinel;
mod wgpu_render_module;

pub use positioned::*;
pub use sentinel::*;
pub use wgpu_render_module::*;

use crate::util::types::ObjectKind;

pub struct Update<'a, V: 'a> {
    pub vertices: &'a [V],
    pub indices: &'a [u16],
}

impl<'a, V: 'a> From<&'a ([V; 1], [u16; 1])> for Update<'a, V> {
    fn from(value: &'a ([V; 1], [u16; 1])) -> Self {
        Self {
            vertices: &value.0,
            indices: &value.1,
        }
    }
}

impl<'a, V: 'a> From<&'a ([V; 4], [u16; 4])> for Update<'a, V> {
    fn from(value: &'a ([V; 4], [u16; 4])) -> Self {
        Self {
            vertices: &value.0,
            indices: &value.1,
        }
    }
}

impl<'a, V: 'a> From<&'a ([V; 8], [u16; 10])> for Update<'a, V> {
    fn from(value: &'a ([V; 8], [u16; 10])) -> Self {
        Self {
            vertices: &value.0,
            indices: &value.1,
        }
    }
}

pub struct RenderModuleConfigBuilder {
    pub shader_desc: wgpu::ShaderModuleDescriptor<'static>,
    pub topology: wgpu::PrimitiveTopology,
    pub blend: Option<wgpu::BlendState>,
    pub name: &'static str,
    pub kind: ObjectKind,
    pub depth_write_enabled: bool,
}

impl Default for RenderModuleConfigBuilder {
    fn default() -> Self {
        Self {
            shader_desc: wgpu::include_wgsl!("../../shaders/positioned.wgsl"),
            topology: wgpu::PrimitiveTopology::TriangleList,
            blend: None,
            name: "unnamed",
            kind: ObjectKind::Unknown,
            depth_write_enabled: true,
        }
    }
}

impl RenderModuleConfigBuilder {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        Self::default()
    }
    pub fn build(self) -> RenderModuleConfig {
        RenderModuleConfig {
            shader_desc: self.shader_desc,
            topology: self.topology,
            blend: self.blend,
            name: self.name,
            kind: self.kind,
            depth_write_enabled: self.depth_write_enabled,
        }
    }
    pub fn with_shader_desc(mut self, shader_desc: wgpu::ShaderModuleDescriptor<'static>) -> Self {
        self.shader_desc = shader_desc;
        self
    }
    pub fn with_topology(mut self, topology: wgpu::PrimitiveTopology) -> Self {
        self.topology = topology;
        self
    }
    pub fn with_blend(mut self, blend: Option<wgpu::BlendState>) -> Self {
        self.blend = blend;
        self
    }
    pub fn with_name(mut self, name: &'static str) -> Self {
        self.name = name;
        self
    }
    pub fn with_kind(mut self, kind: ObjectKind) -> Self {
        self.kind = kind;
        self
    }
    pub fn with_depth_write_enabled(mut self, depth_write_enabled: bool) -> Self {
        self.depth_write_enabled = depth_write_enabled;
        self
    }
}

pub struct RenderModuleConfig {
    pub shader_desc: wgpu::ShaderModuleDescriptor<'static>,
    pub topology: wgpu::PrimitiveTopology,
    pub blend: Option<wgpu::BlendState>,
    pub name: &'static str,
    pub kind: ObjectKind,
    pub depth_write_enabled: bool,
}
