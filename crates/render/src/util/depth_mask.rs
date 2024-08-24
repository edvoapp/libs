use crate::model::{Position, Quad, QuadVertex};
use crate::modules::{PositionedRenderModule, RenderModuleConfigBuilder, Sentinel};
use crate::util::types::ObjectKind;

use std::rc::Rc;
use wasm_bindgen::prelude::*;

type Id = usize;

#[wasm_bindgen]
pub struct DepthMaskService {
    instances: Vec<(Id, Position)>,
    render_module: Rc<PositionedRenderModule<QuadVertex, Position>>,
    counter: usize,
}

#[wasm_bindgen]
impl DepthMaskService {
    #[allow(clippy::new_without_default)]
    pub fn new() -> Self {
        let render_module = PositionedRenderModule::<QuadVertex, Position>::new(
            RenderModuleConfigBuilder::new()
                .with_topology(wgpu::PrimitiveTopology::TriangleStrip)
                .with_name("depth-mask")
                .with_kind(ObjectKind::DepthMask)
                .build(),
        );
        render_module.update::<&([QuadVertex; 4], [u16; 4])>(
            &Quad::new(0.0, 0.0, 1.0, 1.0, [0.0, 0.0, 0.0, 0.0]).into(),
        );

        Self {
            render_module,
            instances: vec![(0, Position::from_xyz(0.0, 0.0, 0, 0.0, 0.0))],
            counter: 0,
        }
    }

    pub fn sentinel(&self) -> Option<Sentinel> {
        Some(Sentinel::new(&self.render_module))
    }

    pub fn add_instance(
        &mut self,
        left: f32,
        top: f32,
        width: f32,
        height: f32,
        z_index: i32,
    ) -> Id {
        let position = Position::from_xyz(left, top, z_index, width, height);
        self.counter += 1;
        self.instances.push((self.counter, position));

        // TODO: implement `add_instance()` method on PositionedRenderModule later
        self.render_module.update_instances(
            &self
                .instances
                .iter()
                .map(|i| i.1)
                .collect::<Vec<Position>>(),
            None,
        );

        self.counter
    }

    pub fn update_instance(
        &mut self,
        id: usize,
        left: f32,
        top: f32,
        width: f32,
        height: f32,
        z_index: i32,
    ) {
        let position = Position::from_xyz(left, top, z_index, width, height);
        if let Some(instance) = self.instances.iter_mut().find(|(i, _)| *i == id) {
            instance.1 = position;
        }
        self.render_module.update_instances(
            &self
                .instances
                .iter()
                .map(|i| i.1)
                .collect::<Vec<Position>>(),
            None,
        );
    }

    pub fn remove_instance(&mut self, id: usize) {
        self.instances.retain(|(i, _)| *i != id);
        self.render_module.update_instances(
            &self
                .instances
                .iter()
                .map(|i| i.1)
                .collect::<Vec<Position>>(),
            None,
        );
    }
}
