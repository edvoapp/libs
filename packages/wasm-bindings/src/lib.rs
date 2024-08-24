use wasm_bindgen::prelude::*;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();

    log::set_logger(&wasm_bindgen_console_logger::DEFAULT_LOGGER).unwrap();
    log::set_max_level(log::LevelFilter::Info);

    log::info!("webapp native wasm start");
}

pub use edvo_model::db::firestore_js::*;
pub use edvo_model::property::*;
pub use edvo_model::session_manager::*;
pub use edvo_viewmodel::node::*;
pub use edvo_viewmodel::util::*;
pub use render::*;
