// TODO fix property.rs and restore this
// #[cfg(target_arch = "wasm32")]
pub mod firestore_js;

#[cfg(not(target_arch = "wasm32"))]
pub mod firestore;
