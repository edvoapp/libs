use wasm_bindgen::{closure::Closure, JsCast};
use web_sys::EventTarget;

pub struct JsEventListener {
    event_target: EventTarget,
    event: &'static str,
    callback: Option<Closure<dyn FnMut()>>,
}

impl JsEventListener {
    pub fn new(
        element: impl AsRef<EventTarget>,
        event: &'static str,
        callback: Closure<dyn FnMut()>,
    ) -> Self {
        let event_target: &EventTarget = element.as_ref();

        event_target
            .add_event_listener_with_callback(event, callback.as_ref().unchecked_ref())
            .unwrap();

        Self {
            event_target: event_target.clone(),
            event,
            callback: Some(callback),
        }
    }
}

impl Drop for JsEventListener {
    fn drop(&mut self) {
        if let Some(cb) = self.callback.take() {
            let _ = self
                .event_target
                .remove_event_listener_with_callback(self.event, cb.as_ref().unchecked_ref());
        }
    }
}
