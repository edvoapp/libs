use std::any::Any;
use std::rc::Rc;

use wgpu::SurfaceConfiguration;

use crate::util::types::ObjectKind;
use crate::wgpu_renderer::WgpuRenderer;

pub trait WgpuRenderModule {
    fn render<'module: 'pass, 'pass>(
        &'module self,
        pass: &mut wgpu::RenderPass<'pass>,
        module_context: &'module Rc<dyn Any>,
        viewport_bind_group: &'pass wgpu::BindGroup,
        surface_config: &SurfaceConfiguration,
        dpr: f32,
    );
    fn module_context(&self) -> Option<Rc<dyn Any>>;
    fn kind(&self) -> ObjectKind;
    fn evict_module_context(&self);
    fn reinit_module_context(&self, renderer: &WgpuRenderer);
}
