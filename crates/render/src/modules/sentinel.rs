use std::{
    any::Any,
    rc::{Rc, Weak},
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Sentinel {
    obj: Weak<dyn Any>,
}

#[wasm_bindgen]
impl Sentinel {
    pub fn alive(&self) -> bool {
        self.obj.upgrade().is_some()
    }
}

impl Sentinel {
    pub fn new<T: 'static>(obj: &Rc<T>) -> Self
    where
        T: Any,
    {
        Self {
            obj: Rc::downgrade(obj) as Weak<dyn Any>,
        }
    }
}
