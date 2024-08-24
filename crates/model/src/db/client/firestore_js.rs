use crate::{
    db::firestore_js::js_firebase::TrxFireOp,
    entity::{DocumentRef, JsEntity},
    session_manager::use_session_manager,
    transaction::{
        ActiveTrxStore, Open, Ref, Transaction, TrxApplyErr, TrxHandle, TrxRef, Unknown,
    },
};

use futures::FutureExt;
use js_sys::{Array, JsString};
use std::{cell::OnceCell, ops::Deref};
use wasm_bindgen::prelude::*;

mod closures {
    use futures::Future;
    use wasm_bindgen::{prelude::wasm_bindgen, JsCast, JsValue};
    use wasm_bindgen_futures::JsFuture;

    use super::FireDbRef;
    use crate::transaction::TrxHandle;

    #[wasm_bindgen(typescript_custom_section)]
    const TRX_OP: &'static str = r#"
type TerminalHookFn = () => void | Promise<void>;
type TrxVoidOp = (trx: TrxRef) => void | Promise<void>;
type PrecommitFn = (trx: TrxRef) => void;
"#;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(typescript_type = "TerminalHookFn")]
        pub type TerminalHook;
    }

    impl TerminalHook {
        pub fn call(self) -> Option<impl Future<Output = ()> + 'static> {
            let f: js_sys::Function = self.obj.into();
            let res = f.call0(&JsValue::null());
            to_future(res, "TerminalHookFn")
        }
    }

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(typescript_type = "PrecommitFn")]
        pub type PrecommitFn;
    }

    impl PrecommitFn {
        pub fn call<S>(self, trx: &TrxHandle<FireDbRef, S>) -> Result<(), String> {
            let f: js_sys::Function = self.obj.into();
            let js_trx = trx.into();
            match f.call1(&JsValue::null(), &js_trx) {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("PrecommitFn error: {e:?}")),
            }
        }
    }

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(typescript_type = "TrxVoidOp")]
        pub type TrxVoidOp;
    }

    impl TrxVoidOp {
        pub fn call<S>(
            self,
            trx: &TrxHandle<FireDbRef, S>,
        ) -> Option<impl Future<Output = ()> + 'static> {
            let f: js_sys::Function = self.obj.into();
            let js_trx = trx.into();
            let res = f.call1(&JsValue::null(), &js_trx);
            to_future(res, "TrxVoidOp")
        }
    }

    fn to_future(
        res: Result<JsValue, JsValue>,
        tag: &'static str,
    ) -> Option<impl Future<Output = ()> + 'static> {
        let future = match res {
            Ok(promise) => {
                if !promise.is_instance_of::<js_sys::Promise>() {
                    return None;
                }
                let future: JsFuture = js_sys::Promise::from(promise).into();
                future
            }
            Err(err) => {
                log::error!("Error: {err:?}");
                return None;
            }
        };
        Some(async move {
            match future.await {
                Ok(_) => {}
                Err(e) => log::error!("{tag}: {e:?}"),
            }
        })
    }
}
pub use closures::{PrecommitFn, TerminalHook, TrxVoidOp};

mod on_access_denied {
    use std::cell::RefCell;

    use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

    #[wasm_bindgen(typescript_custom_section)]
    const TYPES: &'static str = r#"
type OnAccessDenied = (msg: string) => void;
"#;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(typescript_type = "OnAccessDenied")]
        pub type OnAccessDenied;
    }

    impl Default for OnAccessDenied {
        fn default() -> Self {
            Self {
                obj: JsValue::undefined(),
            }
        }
    }

    impl OnAccessDenied {
        pub fn call(&self, msg: String) -> Result<(), String> {
            if self.obj.is_undefined() {
                return Err(msg);
            }

            let f: js_sys::Function = self.obj.clone().into();
            let string = JsValue::from_str(msg.as_ref());
            match f.call1(&JsValue::null(), &string) {
                Ok(_) => Ok(()),
                Err(err) => Err(format!("{err:?}")),
            }
        }
    }

    thread_local! {
        static ON_ACCESS_DENIED: RefCell<OnAccessDenied> = RefCell::default();
    }

    #[wasm_bindgen(js_name = "setTrxAccessDeniedHook")]
    pub fn set_trx_access_denied_hook(on_access_denied: OnAccessDenied) {
        ON_ACCESS_DENIED.with(move |cb| {
            cb.replace_with(move |_| on_access_denied);
        });
    }

    pub fn invoke(msg: String) -> Result<(), String> {
        ON_ACCESS_DENIED.with(|cell| {
            let cb = cell.borrow();
            cb.call(msg)
        })
    }
}

mod js_firebase {
    use futures::{future::LocalBoxFuture, lock::Mutex, FutureExt};
    use std::{collections::HashSet, fmt::Debug, sync::Arc};
    use wasm_bindgen::prelude::{wasm_bindgen, JsValue};

    use crate::{
        entity::{DocumentRef, JsEntity},
        transaction::{BatchTrxOpErr, Batchable, FullOpenTrxHandle, TrxCommitErr},
    };

    use super::sanitize_object_without_undefined;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = edvocommon, js_name="firebaseNow")]
        pub fn firebase_now() -> JsValue;
    }

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen]
        pub type FireBatch;

        #[wasm_bindgen(js_namespace = edvocommon, static_method_of = FireBatch, js_name="create")]
        pub fn new() -> FireBatch;
        #[wasm_bindgen(method)]
        fn set(this: &FireBatch, doc_ref: DocumentRef, data: js_sys::Object, merge: bool);
        #[wasm_bindgen(method)]
        fn delete(this: &FireBatch, doc_ref: DocumentRef);
        #[wasm_bindgen(method)]
        async fn commit(this: &FireBatch);
    }

    impl Default for FireBatch {
        fn default() -> Self {
            Self::new()
        }
    }

    #[derive(Clone)]
    pub struct FireDbRef;

    #[derive(Default)]
    pub struct JsFireBatchExtras {
        inserteds: Arc<Mutex<HashSet<String>>>,
    }

    impl JsFireBatchExtras {
        fn add_inserted(&self, path: String) -> bool {
            let mut set = self.inserteds.try_lock().unwrap();
            set.insert(path)
        }

        fn has_inserted(&self, path: &str) -> bool {
            let set = self.inserteds.try_lock().unwrap();
            set.contains(path)
        }
    }

    impl Debug for FireBatch {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            f.debug_tuple("FireBatch").finish()
        }
    }

    impl Batchable for FireDbRef {
        type Op = FireOp;
        type TrxOp = TrxFireOp;
        type Child = FireBatch;
        type Extras = JsFireBatchExtras;

        fn child(&self) -> Result<FireBatch, String> {
            Ok(FireBatch::new())
        }

        fn insert(child: &FireBatch, op: Self::Op) {
            match op {
                FireOp::SetForRef {
                    doc_ref,
                    data,
                    merge,
                } => child.set(doc_ref, data, merge),
                FireOp::Delete { doc_ref } => child.delete(doc_ref),
            }
        }
        fn process_trx_op(
            txh: FullOpenTrxHandle<Self>,
            op: Self::TrxOp,
        ) -> Result<(), BatchTrxOpErr> {
            match op {
                TrxFireOp::Insert { entity, data } => {
                    let path = entity.path();
                    let data = sanitize_object_without_undefined(data);
                    let doc_ref = entity.doc_ref();

                    let _ = txh.add_on_commit_hook(Box::new(move || {
                        entity.set_saved();
                        None
                    }));

                    txh.batch_operation(FireOp::SetForRef {
                        doc_ref,
                        data,
                        merge: true,
                    })?;
                    txh.extras().add_inserted(path);
                }
                TrxFireOp::Update { entity, data } => {
                    let path = entity.path();
                    if !entity.is_editable() {
                        return Err(BatchTrxOpErr::AccessDenied(format!(
                            "Attempt to update non-editable entity({path})"
                        )));
                    }
                    let data = sanitize_object_without_undefined(data);
                    if let Ok(false) = js_sys::Reflect::has(&data, &"updatedAt".into()) {
                        let _ = js_sys::Reflect::set(&data, &"updatedAt".into(), &firebase_now());
                    }

                    let future = {
                        let txh = txh.clone();
                        async move {
                            if !txh.extras().has_inserted(&path) {
                                entity.saved().await;
                            }

                            let doc_ref = entity.doc_ref();
                            txh.process_op(TrxFireOp::SetForRef {
                                doc_ref,
                                data,
                                merge: true,
                            })
                        }
                    };
                    txh.add_future_op(future);
                }
                TrxFireOp::SetForRef {
                    doc_ref,
                    data,
                    merge,
                } => txh.batch_operation(FireOp::SetForRef {
                    doc_ref,
                    data,
                    merge,
                })?,
                TrxFireOp::Delete { entity } => {
                    if !entity.is_editable() {
                        let path = entity.path();
                        return Err(BatchTrxOpErr::AccessDenied(format!(
                            "Attempt to delete non-editable entity({path})"
                        )));
                    }
                    let doc_ref = entity.doc_ref();
                    txh.batch_operation(FireOp::Delete { doc_ref })?;
                }
            }
            Ok(())
        }
        fn commit(child: &FireBatch) -> LocalBoxFuture<'_, Result<(), TrxCommitErr>> {
            async {
                child.commit().await;
                Ok(())
            }
            .boxed_local()
        }

        // TODO: make this reusable
        fn trace_messages(level: u8, messages: &[&dyn std::fmt::Display]) {
            #[wasm_bindgen]
            extern "C" {
                type TraceState;

                #[wasm_bindgen(method, getter)]
                fn level(this: &TraceState) -> u8;
                #[wasm_bindgen(method, getter)]
                fn regex(this: &TraceState) -> js_sys::RegExp;

                #[wasm_bindgen(js_namespace = globalThis, js_name = "getTraceState")]
                fn get_trace_state() -> TraceState;
            }

            let trace_state = get_trace_state();
            if trace_state.level() < level {
                return;
            }
            let mut msgs = Vec::new();
            let mut found = false;
            for msg in messages {
                let msg = msg.to_string();
                if !found {
                    found = trace_state.regex().test(&msg);
                }
                msgs.push(msg)
            }
            if !found {
                return;
            }
            log::info!("level({level}): {msgs:?}");
        }
    }

    #[derive(Debug)]
    pub enum FireOp {
        SetForRef {
            doc_ref: DocumentRef,
            data: js_sys::Object,
            merge: bool,
        },
        Delete {
            doc_ref: DocumentRef,
        },
    }

    #[derive(Debug)]
    pub enum TrxFireOp {
        Insert {
            entity: JsEntity,
            data: js_sys::Object,
        },
        Update {
            entity: JsEntity,
            data: js_sys::Object,
        },
        SetForRef {
            doc_ref: DocumentRef,
            data: js_sys::Object,
            merge: bool,
        },
        Delete {
            entity: JsEntity,
        },
    }
}
pub use js_firebase::FireBatch;

#[wasm_bindgen(js_name = "Transaction")]
pub struct JsTransaction {
    trx: Option<Transaction<FireDbRef>>,
    was_cleaned_up: bool,
}

/// `JsTransaction` exposed to JS and intends to mimic the old transaction.ts Transaction interface
/// Notably, because Wasm-bindgen does not support generics, we have to have this wrapper in order
/// to specify the JsFireBatch implementation of trait Batch
#[wasm_bindgen(js_name = "TrxRef")]
#[derive(Clone)]
pub struct JsTrxRef {
    trx: TrxRef<FireDbRef>,
}

impl Deref for JsTrxRef {
    type Target = TrxRef<FireDbRef>;

    fn deref(&self) -> &Self::Target {
        &self.trx
    }
}

mod js_trx_state {
    use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

    use crate::transaction::TrxState;

    #[wasm_bindgen(typescript_custom_section)]
    const JS_TRX_STATE: &str = r#"
type TrxState =
    | 'pending'
    | 'preparing'
    | 'failed'
    | 'applied'
    | 'committing'
    | 'committed'
    | 'applied';
"#;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(typescript_type = "TrxState")]
        pub type JsTrxState;
    }

    impl From<TrxState> for JsTrxState {
        fn from(value: TrxState) -> Self {
            let state = match value {
                TrxState::Pending => "pending",
                TrxState::Preparing => "preparing",
                TrxState::Failed => "failed",
                TrxState::Committing => "committing",
                TrxState::Committed => "committed",
            };
            JsValue::from(state).into()
        }
    }
}
pub use js_trx_state::JsTrxState;

use self::js_firebase::FireDbRef;

impl JsTransaction {
    fn clean_up(&mut self) {
        if !self.was_cleaned_up {
            use_session_manager().js_decrement_writes();
            if let Some(trx) = self.trx.take() {
                let name = trx.name();
                use_active_trx_store().remove_by_id(&name);
            } else {
                use_active_trx_store().clean_inactive();
            }
            self.was_cleaned_up = true;
        }
    }
}
impl Drop for JsTransaction {
    fn drop(&mut self) {
        self.clean_up();
    }
}

impl JsTransaction {
    pub fn create(name: &str) -> JsTransaction {
        let trx = Transaction::new(FireDbRef, name);
        let active_trx_store = use_active_trx_store();
        active_trx_store.add(&trx);
        drop(active_trx_store);

        let session_manager = use_session_manager();
        session_manager.js_increment_writes();
        drop(session_manager);

        JsTransaction {
            trx: Some(trx),
            was_cleaned_up: false,
        }
    }
}

#[wasm_bindgen(js_class = "Transaction")]
impl JsTransaction {
    pub fn new(name: Option<String>) -> JsTransaction {
        match name {
            Some(name) => JsTransaction::create(&name),
            None => JsTransaction::create("tx"),
        }
    }
}

#[wasm_bindgen(js_class = "Transaction")]
impl JsTransaction {
    pub fn get_ref(&self) -> Option<JsTrxRef> {
        let trx = self.trx.as_deref()?.get_ref();
        Some(JsTrxRef { trx })
    }

    /// Because we're trying to maintain the same TS interface, nobody
    /// is going to call .cleanup/drop on this, so we have to do it ourselves at apply time
    pub async fn apply(&mut self) -> Result<(), String> {
        if let Some(trx) = self.trx.take() {
            let name = trx.name().to_owned();
            let result = trx.apply().await;
            self.clean_up();
            flat_trx_apply_result(&name, result)
        } else {
            Err("defer_unique can only be used against pending/preparing transactions".into())
        }
    }
}

impl JsTransaction {
    pub fn prev_checked(&self) -> Option<Ref<'_, TrxHandle<FireDbRef, Open>>> {
        let trx = self.trx.as_deref()?;
        let txh = trx.checked().ok()?;
        Some(Ref::new(txh))
    }
}

fn flat_trx_apply_result(name: &str, result: Result<(), TrxApplyErr>) -> Result<(), String> {
    let err = match result {
        Ok(_) => return Ok(()),
        Err(err) => err,
    };

    match err {
        TrxApplyErr::AccessDenied(msg) => {
            log::warn!("Transaction({name}): {msg}");
            on_access_denied::invoke(msg)
        }
        TrxApplyErr::Other(msg) => Err(msg),
        TrxApplyErr::FailedCheck(err) => Err(err.to_string()),
    }
}

#[wasm_bindgen(js_class = "Transaction")]
impl JsTransaction {
    pub fn active_store() -> JsActiveTransactions {
        JsActiveTransactions
    }
}

impl<'trx, S> From<&'trx TrxHandle<FireDbRef, S>> for JsTrxRef {
    fn from(value: &'trx TrxHandle<FireDbRef, S>) -> Self {
        let trx = value.get_ref();
        JsTrxRef { trx }
    }
}

impl<'trx, S> From<&'trx TrxHandle<FireDbRef, S>> for JsValue {
    fn from(value: &'trx TrxHandle<FireDbRef, S>) -> Self {
        let trx: JsTrxRef = value.into();
        trx.into()
    }
}

#[wasm_bindgen(js_class = "TrxRef")]
impl JsTrxRef {
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> Result<String, String> {
        let trx = self.trx.upgrade()?;
        Ok(trx.name().into())
    }
    #[wasm_bindgen(getter)]
    pub fn count(&self) -> usize {
        match self.trx.upgrade() {
            Ok(trx) => trx.batch_counter(),
            Err(_) => 0,
        }
    }
    #[wasm_bindgen(getter)]
    pub fn state(&self) -> JsTrxState {
        match self.trx.upgrade() {
            Ok(trx) => trx.state().into(),
            Err(_) => JsValue::from("applied").into(),
        }
    }

    #[wasm_bindgen(getter, js_name = "isPending")]
    pub fn is_pending(&self) -> bool {
        use crate::transaction::TrxState::*;
        match self.trx.upgrade() {
            Ok(trx) => matches!(trx.state(), Pending),
            Err(_) => false,
        }
    }

    pub fn now(&self) -> JsValue {
        js_firebase::firebase_now()
    }

    #[wasm_bindgen(js_name = "addOp")]
    pub fn add_op(&self, _entity: Option<JsEntity>, f: TrxVoidOp) -> Result<(), String> {
        let _ = self.map(|txh| {
            if let Some(future) = f.call(&txh) {
                txh.add_future_op(async move {
                    future.await;
                    Ok(())
                });
            }
        })?;

        Ok(())
    }

    #[wasm_bindgen(js_name = "addPostCommitHook")]
    pub fn add_post_commit_hook(&self, f: TerminalHook) -> Result<(), String> {
        let _: () = self.map(|trx| {
            if let Some(future) = f.call() {
                let cb = move || Some(future.boxed_local());
                trx.add_post_commit_hook(Box::new(cb));
            }
        })?;
        Ok(())
    }

    #[wasm_bindgen(js_name = "addPrecommitHook")]
    pub fn add_pre_commit_hook(&self, f: PrecommitFn) -> Result<(), String> {
        let _: () = self.map(|txh| {
            txh.add_pre_commit_hook(Box::new(move |trx: &TrxHandle<FireDbRef>| f.call(trx)));
        })?;
        Ok(())
    }

    #[wasm_bindgen(js_name = "addAbortHook")]
    pub fn add_abort_hook(&self, _f: TerminalHook) -> Result<(), String> {
        // TODO
        //let trx = self.trx.upgrade_prev_checked()?;
        //trx.add_abort_hook(Box::new(move |_| Some(f.call().boxed_local())));
        Ok(())
    }

    pub fn insert(&self, entity: JsEntity, data: js_sys::Object) -> Result<(), String> {
        self.process_op(TrxFireOp::Insert { entity, data })
    }

    pub fn update(&self, entity: JsEntity, data: js_sys::Object) -> Result<(), String> {
        self.process_op(TrxFireOp::Update { entity, data })
    }

    #[wasm_bindgen(js_name = "setForRef")]
    pub fn set_for_ref(
        &self,
        doc_ref: DocumentRef,
        data: js_sys::Object,
        merge: bool,
    ) -> Result<(), String> {
        self.process_op(TrxFireOp::SetForRef {
            doc_ref,
            data,
            merge,
        })
    }

    pub fn delete(&self, entity: JsEntity) -> Result<(), String> {
        self.process_op(TrxFireOp::Delete { entity })
    }
}

impl JsTrxRef {
    fn process_op(&self, op: TrxFireOp) -> Result<(), String> {
        use crate::transaction::BatchTrxOpErr::*;
        let txh = self.upgrade_checked()?;
        let err = match txh.process_op(op) {
            Ok(_) => return Ok(()),
            Err(err) => err,
        };

        let name = txh.name();
        match err {
            AccessDenied(msg) => {
                log::warn!("Transaction({name}): {msg}");
                on_access_denied::invoke(msg)
            }
            Other(e) => Err(format!("Transaction({name}): {e}")),
            ClosedForAddingOps => {
                let name = txh.name();
                let msg = format!("Transaction({name}): Can not accept more operations");
                Err(msg)
            }
        }
    }
}

thread_local! {
  pub static ACTIVE_TRX_STORE: OnceCell<ActiveTrxStore<FireDbRef>> = OnceCell::new();
}

pub fn use_active_trx_store() -> ActiveTrxStore<FireDbRef> {
    ACTIVE_TRX_STORE.with(|cell| cell.get_or_init(ActiveTrxStore::default).clone())
}

#[wasm_bindgen(js_name = "ActiveTransactions")]
#[derive(Default, Clone, PartialEq)]
pub struct JsActiveTransactions;

#[wasm_bindgen(js_class = "ActiveTransactions")]
impl JsActiveTransactions {
    #[wasm_bindgen(getter)]
    pub fn count(&self) -> u32 {
        let store = use_active_trx_store();
        store.count()
    }

    #[wasm_bindgen(getter, js_name = "nameList")]
    pub fn name_list(&self) -> Box<[JsString]> {
        let store = use_active_trx_store();
        store
            .map(|trx: &TrxHandle<FireDbRef, Unknown>| trx.name().into())
            .into_boxed_slice()
    }
}

#[cfg(test)]
mod test {
    use crate::db::firestore_js::js_firebase::FireDbRef;

    use super::{use_active_trx_store, ActiveTrxStore};

    #[test]
    fn global_active_test() {
        let store1 = use_active_trx_store();
        let store2 = use_active_trx_store();
        let other = ActiveTrxStore::<FireDbRef>::default();
        assert_eq!(store1, store2);
        assert_ne!(store1, other);
    }
}

/*

JsObj

impl From<JsObj> for Vertex {}
impl From<JsObj> for Property {}
impl From<JsObj> for BackRef {}

JS
console.log()


console::log_string(str: &str)
console::log_u32(str: &str)
console::log_any_other(str: &str)

*/

// serde: serialize + deserialize

// enum Value {
//     Null,
//     Bool(bool),
//     String(string),
//     Object(HashMap<String, Value>),
//     ...
// }

// let mut map = HashMap::new<String, serde_json::Value>();

// // put stuff in the map...

// let obj = js_sys::Object::new();
// for (k,v) in map.iter() {
//     let key = JsValue::from(k);
//     let value = JsValue::from(v);
//     js_sys::Reflect::set(&obj, &key, &value).unwrap();
// }
// JsValue::from(obj)

#[wasm_bindgen]
pub fn sanitize_object_without_undefined(data: js_sys::Object) -> js_sys::Object {
    use js_sys::Object;

    let entries = Object::entries(&data).filter(&mut |entry, __, _| {
        let kv = Array::from(&entry);

        let v = kv.at(1);
        let is_undefined = v.is_undefined();
        if is_undefined {
            let k = kv.at(0).as_string().unwrap();
            log::warn!("Key {k} had an undefined value, this may not have been intentional")
        }
        !is_undefined
    });

    Object::from_entries(&entries).unwrap()
}

// /// Generates a key like in EdvoObj.key
// fn generate_key() -> JsString {
//     let random_number: f64 = js_sys::Math::random();
//     let number = js_sys::Number::from(random_number);
//     let random_string = number.to_string(36).unwrap();
//     let index_end = random_string.length();
//     random_string.substring(8, index_end)
// }
