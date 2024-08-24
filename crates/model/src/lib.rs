// TODO fix rust analyzer for conditional compilation
// #[cfg(not(target_arch = "wasm32"))]
// pub mod fsclient;

pub mod db;

pub mod entity;
pub mod property;
pub mod vertex;
// pub mod edge
// pub mod backref

pub mod search;
pub mod session_manager;
pub mod text_range;
pub mod timer;
pub mod transaction;
pub mod undo;
pub mod utils;
