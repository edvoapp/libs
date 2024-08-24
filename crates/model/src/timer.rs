use std::{cell::RefCell, rc::Rc};

use wasm_bindgen::prelude::*;

pub struct CallbackTimer {
    timer: Option<(i32, Closure<dyn FnMut()>)>,
}

#[derive(Clone)]
pub struct IntervalTimer(Rc<RefCell<Option<IntervalInner>>>);

struct IntervalInner {
    id: i32,
    #[allow(dead_code)]
    closure: Closure<dyn FnMut()>,
}

#[wasm_bindgen]
extern "C" {
    #[allow(non_camel_case_types)]
    type window;

    #[wasm_bindgen(js_name = setTimeout, static_method_of = window)]
    fn set_timeout(closure: &Closure<dyn FnMut()>, timeout: i32) -> i32;
    #[wasm_bindgen(js_name = clearTimeout, static_method_of = window)]
    fn clear_timeout(id: i32);

    #[wasm_bindgen(js_name = setInterval, static_method_of = window)]
    fn set_interval(closure: &Closure<dyn FnMut()>, interval: i32) -> i32;
    #[wasm_bindgen(js_name = clearInterval, static_method_of = window)]
    fn clear_interval(id: i32);
}

impl CallbackTimer {
    pub fn new(millis: u32, callback: Box<dyn FnOnce()>) -> CallbackTimer {
        // TODO: call .take inside a wrapping closure to ensure we don't cancel an already-fired timeout
        // Ideally this would entail building the Closure::once with a borrowed closure, but may require Rc<Refcell<Option<Timer>>>.clone()
        let closure = Closure::once(callback);

        let id = window::set_timeout(&closure, millis as i32);

        CallbackTimer {
            timer: Some((id, closure)),
        }
    }
    pub fn cancel(mut self) {
        if let Some((id, _)) = self.timer.take() {
            window::clear_timeout(id);
        }
    }
}

// keep the closure alive, and clearing timeout on drop are ESSENTIAL to ensuring memory safety
impl Drop for CallbackTimer {
    fn drop(&mut self) {
        if let Some((id, _)) = self.timer.take() {
            window::clear_timeout(id);
        }
    }
}

impl IntervalTimer {
    pub fn new(millis: u32, mut callback: Box<dyn FnMut(usize) -> bool>) -> IntervalTimer {
        // TODO: call .take inside a wrapping closure to ensure we don't cancel an already-fired timeout
        // Ideally this would entail building the Closure::once with a borrowed closure, but may require Rc<Refcell<Option<Timer>>>.clone()

        // Create an intert interval
        let me = IntervalTimer(Rc::new(RefCell::new(None)));
        let me2 = me.clone();

        let mut i = 0;

        // Prepare our helper closure which can cancel the interval
        let closure = Closure::new(move || {
            i += 1;
            if !callback(i) {
                me2.cancel();
            }
        });

        // Actually initiate the interval with the browser event loop
        let id = window::set_interval(&closure, millis as i32);

        // Inject the inner to activate the IntervalTimer
        *me.0.borrow_mut() = Some(IntervalInner { id, closure });

        me
    }

    pub fn cancel(&self) -> bool {
        if let Some(IntervalInner { id, .. }) = self.0.borrow_mut().take() {
            window::clear_interval(id);
            true
        } else {
            false
        }
    }
}

// keep the closure alive, and clearing timeout on drop are ESSENTIAL to ensuring memory safety
impl Drop for IntervalInner {
    fn drop(&mut self) {
        window::clear_interval(self.id);
    }
}
