use std::{
    cell::{Cell, OnceCell},
    marker::PhantomData,
    sync::Arc,
};

use observable_react::JsObservable;
use observable_rs::{Observable, Reader};
use wasm_bindgen::prelude::*;

#[derive(Clone, Default)]
pub enum Status {
    #[default]
    Init,
    Clean,
    Dirty,
    Error,
}

impl From<Status> for &str {
    fn from(value: Status) -> Self {
        match value {
            Status::Init => "init",
            Status::Clean => "clean",
            Status::Dirty => "dirty",
            Status::Error => "error",
        }
    }
}

impl From<Status> for JsValue {
    fn from(value: Status) -> Self {
        let val: &str = value.into();
        val.into()
    }
}

#[derive(Default)]
struct Inner {
    pending_writes: Cell<usize>,
    pending_errors: Cell<usize>,
    status: Observable<Status>,
}

impl Inner {
    fn increment_writes(&self) {
        let pw = self.pending_writes.get() + 1;
        self.pending_writes.set(pw);
        self.update_status();
    }
    fn decrement_writes(&self) {
        let pw = self.pending_writes.get() - 1;
        self.pending_writes.set(pw);
        self.update_status();
    }
    fn increment_errors(&self) {
        let pw = self.pending_errors.get() + 1;
        self.pending_errors.set(pw);
        self.update_status();
    }
    fn decrement_errors(&self) {
        let pe = self.pending_errors.get() - 1;
        self.pending_errors.set(pe);
        self.update_status();
    }

    fn update_status(&self) {
        let pw = self.pending_writes.get();
        let pe = self.pending_errors.get();
        self.status.set(
            if pe > 0 { Status::Error }
                else if pw > 0 { Status::Dirty }
                else { Status::Clean }
        )
    }
}

#[wasm_bindgen]
#[derive(Clone, Default)]
pub struct SessionManager {
    inner: Arc<Inner>,
}
impl SessionManager {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn status(&self) -> Reader<Status> {
        self.inner.status.reader()
    }
    pub fn current_session<'s>(&self) -> CurrentSession<'s> {
        CurrentSession::new(self.clone())
    }
}

#[wasm_bindgen]
impl SessionManager {
    #[wasm_bindgen(js_name = increment_writes)]
    pub fn js_increment_writes(&self) {
        self.inner.increment_writes()
    }
    #[wasm_bindgen(js_name = decrement_writes)]
    pub fn js_decrement_writes(&self) {
        self.inner.decrement_writes()
    }
    #[wasm_bindgen(js_name = increment_errors)]
    pub fn js_increment_errors(&self) {
        self.inner.increment_errors()
    }
    #[wasm_bindgen(js_name = decrement_errors)]
    pub fn js_decrement_errors(&self) {
        self.inner.decrement_errors()
    }
    // TODO auto-generate this with a macro
    #[wasm_bindgen(js_name = status)]
    pub fn js_status(&self) -> JsObservable {
        self.status().into()
    }
}

pub struct CurrentSession<'s> {
    sm: SessionManager,
    phantom: PhantomData<&'s SessionManager>,
}
impl<'s> CurrentSession<'s> {
    fn new(sm: SessionManager) -> CurrentSession<'s> {
        sm.inner.increment_writes();
        Self {
            sm,
            phantom: PhantomData,
        }
    }
}
impl<'s> Drop for CurrentSession<'s> {
    fn drop(&mut self) {
        self.sm.inner.decrement_writes();
    }
}

thread_local! {
    pub static SESSION_MANAGER: OnceCell<SessionManager> = OnceCell::new();
}

#[wasm_bindgen]
pub fn use_session_manager() -> SessionManager {
    SESSION_MANAGER.with(|cell| cell.get_or_init(SessionManager::new).clone())
}

#[cfg(test)]
mod test {
    use std::sync::Arc;

    use super::{use_session_manager, SessionManager};

    #[test]
    fn global_session_manager_test() {
        let sm1 = use_session_manager();
        let sm2 = use_session_manager();
        let other = SessionManager::new();
        assert!(Arc::ptr_eq(&sm1.inner, &sm2.inner));
        assert!(!Arc::ptr_eq(&sm1.inner, &other.inner));
    }
}
