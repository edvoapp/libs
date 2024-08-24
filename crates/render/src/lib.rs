pub mod model;
pub mod modules;
pub mod shape;
pub mod viewmodel;

mod context;
mod svg;
mod util;

mod app_controller;
use app_controller::AppController;

mod wgpu_renderer;
use wgpu_renderer::WgpuRenderer;

use std::cell::RefCell;
use wasm_bindgen::prelude::*;

thread_local! {
    pub static APP_CONTROLLER: RefCell<Option<AppController>> = RefCell::new(None);
}

/// Call this ONCE ONLY on initialization of the app.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub async fn load_app_controller() -> AppController {
    let renderer = WgpuRenderer::new();
    renderer.conditionally_init_context();

    let controller = AppController::new(renderer.clone());
    let c1 = controller.clone();

    APP_CONTROLLER.with(move |c| *c.borrow_mut() = Some(c1));

    controller
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
pub fn get_app_controller() -> AppController {
    APP_CONTROLLER.with(|ac| {
        ac.borrow()
            .as_ref()
            .expect("app controller must be loaded before calling `get_app_controller()`")
            .clone()
    })
}

pub fn get_renderer() -> Option<WgpuRenderer> {
    APP_CONTROLLER.with(|ac| (*ac.borrow()).as_ref().map(|c| c.renderer.clone()))
}
