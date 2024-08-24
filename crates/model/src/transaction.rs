mod batch;
mod store;

mod utils;

pub use batch::*;
pub use store::*;
pub use utils::*;

use futures::{
    future::{join, try_join_all, LocalBoxFuture},
    Future,
};

use std::{
    cell::Cell,
    fmt::{Debug, Display},
    mem,
    ops::{Deref, DerefMut},
    pin::Pin,
    sync::{Arc, Mutex, Weak},
};

thread_local! {
  pub static TRX_COUNTER: Cell<u32> = Cell::new(0);
}

pub fn use_trx_counter() -> u32 {
    TRX_COUNTER.with(|cell| {
        let current = cell.get();
        cell.set(current + 1);
        current
    })
}

pub type TrxErr = String;
pub type OpResult = Result<(), TrxErr>;

pub struct Unknown;
pub struct Open;

/// Arc, Weak
/// Urc (non-clonable Arc), Weak, Ref<'trx,T> (strong reference with lifetime)

/// When you want to open a database transaction, you will create a `Transaction` struct
/// This is the only struct that can apply the database transaction.
/// You may pass it around if you want to transfer responsibility for applying the transaction,
/// but *crucially*, it does NOT implement Clone, and it should not be passed to parts of the
/// code adding operations to said transaction. Use .get_ref() to get a TrxRef for that.
///
/// Variable naming convention - in order to avoid confusion, the official naming convention for variables is:
/// transaction : Transaction<
/// txr : TrxRef
/// txh : TrxHandle
///
/// This is similar to
/// ```
/// // pub struct Transaction<B>(Arc<Inner<B>>);
/// ```
/// But provides access to methods
pub struct Transaction<B: Batchable> {
    parent: B,
    handle: TrxHandle<B, Open>,
}

// Transaction - this is the thing you hold when you are the "owner" of the transaction
// TrxRef - this is the thing you can give out freely
// TrxHandle - this is the thing you can get from the TrxRef when you want to add something to the transaction

/// a `TrxHandle` is a strong reference to the transaction which can add operations, but cannot control the transaction
/// To allow simple cases top operate on the transaction directly
/// We allow deref of Transaction to
pub struct TrxHandle<B: Batchable, S = Open> {
    inner: Arc<Inner<B>>,
    phantom: std::marker::PhantomData<S>,
}

/// A reference to a transaction
pub struct TrxRef<B: Batchable>(Weak<Inner<B>>);

#[derive(Default, Debug, Clone, Copy, PartialEq)]
pub enum TrxState {
    #[default]
    Pending,
    Preparing,
    Failed,
    Committing,
    Committed,
    //Applied,
}

/// ```compile_fail
/// // This is a GREAT reason to have Transaction(TrxHandle)
/// let transaction = Transaction::new();
/// do_a_thing_that_takes_txh(&transaction)
/// ```
///
/// Saving a few lines of code here isn't that good of a reason
/// Saving a few lines of code at a bunch of callsites - is a GREAT reason
/// BUT: is this actually useful with TrxHandle<_,_,Unknown> ??
/// if you have to call (transaction as &TrxHandle).check
/// that's not any better than transaction.upgrade{_prev_checked}
impl<B: Batchable> Deref for Transaction<B> {
    type Target = TrxHandle<B, Open>;

    fn deref(&self) -> &Self::Target {
        &self.handle
    }
}

impl<B: Batchable> Clone for TrxRef<B> {
    fn clone(&self) -> Self {
        TrxRef(self.0.clone())
    }
}

impl<B: Batchable> Transaction<B> {
    pub fn new(parent: B, name: &str) -> Self {
        Self {
            handle: TrxHandle::new(Inner::new(name)),
            parent,
        }
    }
}
impl<B: Batchable, S> TrxHandle<B, S> {
    fn new(inner: Arc<Inner<B>>) -> Self {
        TrxHandle {
            inner,
            phantom: Default::default(),
        }
    }
    fn clone_casted<R>(&self) -> TrxHandle<B, R> {
        TrxHandle {
            inner: self.inner.clone(),
            phantom: Default::default(),
        }
    }
    pub fn name(&self) -> &str {
        &self.inner.name
    }
    pub fn batch_counter(&self) -> usize {
        self.inner.counter.get()
    }
    pub fn state(&self) -> TrxState {
        self.inner.state.get()
    }

    pub fn get_ref(&self) -> TrxRef<B> {
        TrxRef(Arc::downgrade(&self.inner))
    }

    /// convert a TrxHandle to checked TrxHandle<Open>
    pub fn checked(&self) -> Result<TrxHandle<B, Open>, TrxCheckErr> {
        self.inner.check_status()?;
        Ok(self.clone_casted())
    }
}

pub struct TxhOp<B: Batchable>(TrxHandle<B, Open>);
impl<B: Batchable> TxhOp<B> {
    fn new<'a, State>(txh: &'a TrxHandle<B, State>) -> Result<Self, TrxCheckErr> {
        txh.inner.check_status()?;
        let this = Self(txh.clone_casted());
        Ok(this)
    }
}
impl<B: Batchable> Deref for TxhOp<B> {
    type Target = TrxHandle<B, Open>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl<B: Batchable> TrxHandle<B, Open> {
    pub fn add_op<Fun, Fut>(&self, f: Fun)
    where
        B: 'static,
        Fut: Future<Output = Result<TxhOp<B>, BatchTrxOpErr>>,
        Fun: 'static,
        Fun: FnOnce(TxhOp<B>) -> Fut,
    {
        let Ok(txh) = TxhOp::new(&self) else {
            return;
        };

        let future = async move {
            let _: TxhOp<B> = f(txh).await?;
            Ok(())
        };
        self.add_future_op(future);
    }
    pub fn add_future_op<Fut>(&self, future: Fut)
    where
        Fut: Future<Output = Result<(), BatchTrxOpErr>> + 'static,
    {
        self.add_boxed_op(Box::pin(future));
    }
    pub fn add_boxed_op(&self, future: TrxOppFuture<'static>) {
        self.inner.add_boxed_op(future);
    }

    pub fn add_on_commit_hook(&self, f: TerminalookFn) {
        self.inner.on_commit_hooks.try_lock().unwrap().push(f);
    }

    pub fn add_post_commit_hook(&self, f: TerminalookFn) {
        self.inner.on_post_commit_hooks.try_lock().unwrap().push(f);
    }

    pub fn add_pre_commit_hook(&self, f: PreCommitHookFn<B>) {
        self.inner.on_pre_commit_hooks.try_lock().unwrap().push(f)
    }
    pub fn process_op(&self, op: B::TrxOp) -> Result<(), BatchTrxOpErr> {
        let txh = FullOpenTrxHandle(self.clone_casted());
        B::process_trx_op(txh, op)
    }
}

pub struct FullOpenTrxHandle<B: Batchable>(TrxHandle<B, Open>);
impl<B: Batchable> Deref for FullOpenTrxHandle<B> {
    type Target = TrxHandle<B, Open>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl<B: Batchable> Clone for FullOpenTrxHandle<B> {
    fn clone(&self) -> Self {
        Self(TrxHandle::<B, Open>::new(self.inner.clone()))
    }
}
impl<B: Batchable> FullOpenTrxHandle<B> {
    pub fn batch_operation(&self, op: B::Op) -> Result<(), BatchTrxOpErr>
    where
        B: Batchable,
    {
        let op_debug = format!("{op:?}");

        self.inner.add_op(op)?;
        B::trace_messages(
            2,
            &[
                &format!("DBAUDIT: Transaction({}).batch_operation", self.inner.name),
                &op_debug,
            ],
        );
        Ok(())
    }

    pub fn extras(&self) -> &'_ B::Extras {
        &self.inner.extras
    }
}

type PreCommitHookFn<B> = Box<dyn FnOnce(&TrxHandle<B>) -> OpResult>;
type TerminalookFn = Box<dyn FnOnce() -> Option<LocalBoxFuture<'static, ()>>>;

type TrxOppFuture<'a> = Pin<Box<dyn Future<Output = Result<(), BatchTrxOpErr>> + 'a>>;
struct Inner<B: Batchable> {
    name: String,
    state: MutexCell<TrxState>,
    ops: Mutex<Vec<B::Op>>,
    counter: MutexCell<usize>,
    on_pre_commit_hooks: Mutex<Vec<PreCommitHookFn<B>>>,
    on_commit_hooks: Mutex<Vec<TerminalookFn>>,
    on_post_commit_hooks: Mutex<Vec<TerminalookFn>>,
    scheduled: Mutex<Vec<TrxOppFuture<'static>>>,
    extras: B::Extras,
}

impl<B: Batchable> Transaction<B> {
    pub async fn apply(self) -> Result<(), TrxApplyErr> {
        let inner = &self.handle.inner;

        let count = inner.counter.get();
        B::trace_messages(
            2,
            &[
                &inner.name,
                &format!("DBAUDIT: .apply() {} statements", count),
            ],
        );
        B::trace_messages(4, &[&inner.name, &"DBAUDIT: apply (start)"]);

        // Given than in rust, apply drops transaction, it won't be possible to
        // apply twice, then, this condition could be unnecessary
        //if inner.is_pending() {
        //    return Err("you can only apply a transaction that is pending".into())
        //}
        inner.state.set(TrxState::Preparing);

        loop {
            if let Some(op_batch) = inner.take_ops() {
                B::trace_messages(
                    4,
                    &[
                        &inner.name,
                        &format!("DBAUDIT: in ops ({})", op_batch.len()),
                    ],
                );
                try_join_all(op_batch).await?;
                continue;
            }

            if inner.dispatch_pre_commit_hooks()? {
                continue;
            }

            break;
        }

        inner.state.set(TrxState::Committing);
        B::trace_messages(4, &[&inner.name, &"apply (committing"]);

        let commit_future = self.commit();

        let on_commit_hooks_futures = inner.dispatch_on_commit_hooks();

        let result = match commit_future.await {
            Ok(_) => {
                B::trace_messages(4, &[&inner.name, &"apply (committed)"]);
                B::trace_messages(
                    2,
                    &[
                        &inner.name,
                        &format!("DBAUDIT: .commit() {} statements", inner.counter.get()),
                    ],
                );
                inner.state.set(TrxState::Committed);
                let post_commit_hooks_futures = inner.dispatch_post_commit_hooks();

                // TODO: replace join_all by something more efficiente
                join(
                    process_all(on_commit_hooks_futures),
                    process_all(post_commit_hooks_futures),
                )
                .await;

                B::trace_messages(
                    4,
                    &[&inner.name, &".apply() (commit ops completed succesfully)"],
                );
                Ok(())
            }
            Err(err) => {
                log::error!("An error occurred committing this transaction: {err}");
                inner.state.set(TrxState::Failed);
                // console.debug({
                //     //entities: this.entities,
                //     //pendingEntities: this.pendingEntities,
                //     trx: this,
                //     batch: this.batch,
                //   });
                B::trace_messages(
                    4,
                    &[&inner.name, &"apply (commit ops completed with error)"],
                );
                Err(err.into())
            }
        };

        result
    }

    async fn commit(&self) -> Result<(), TrxCommitErr> {
        let inner = &*self.handle.inner;
        let Ok(mut ops) = inner.ops.try_lock() else {
            return Err(format!("Transaction({}) can not be commited", inner.name))?;
        };

        if ops.is_empty() {
            return Ok(());
        }

        let mut batches: Vec<B::Child> = Vec::new();

        while !ops.is_empty() {
            let n = ops.len().min(B::LIMIT);
            let batch = self.parent.child()?;
            for op in ops.drain(..n) {
                B::insert(&batch, op);
            }
            match B::commit(&batch).await {
                Ok(_) => batches.push(batch),
                Err(e) => {
                    while let Some(_batch) = batches.pop() {
                        // TODO: implement revert
                        //batch.revert();
                    }
                    return Err(e);
                }
            }
        }

        Ok(())
    }
}

impl<B: Batchable> Inner<B> {
    fn new(name: &str) -> Arc<Inner<B>> {
        let trx_counter = use_trx_counter();

        let inner = Arc::new(Inner {
            name: format!("{name}-{trx_counter}"),
            state: Default::default(),
            counter: MutexCell::new(0),
            ops: Default::default(),
            on_commit_hooks: Default::default(),
            on_post_commit_hooks: Default::default(),
            on_pre_commit_hooks: Default::default(),
            scheduled: Default::default(),
            extras: Default::default(),
        });
        B::trace_messages(2, &[&inner.name, &"CREATED"]);
        inner
    }

    fn is_pending_or_preparing(&self) -> bool {
        let state = self.state.get();
        state == TrxState::Pending || state == TrxState::Preparing
    }

    fn take_ops(&self) -> Option<Vec<TrxOppFuture>> {
        let mut scheduled = self.scheduled.try_lock().unwrap();
        if scheduled.is_empty() {
            None
        } else {
            let ops = mem::take(scheduled.deref_mut());
            Some(ops)
        }
    }

    /// return true if a precommit hook was dispatched
    fn dispatch_pre_commit_hooks(self: &Arc<Inner<B>>) -> Result<bool, TrxApplyErr> {
        let mut guard = self.on_pre_commit_hooks.try_lock().unwrap();
        if guard.is_empty() {
            return Ok(false);
        }
        let callbacks = mem::take(guard.deref_mut());
        drop(guard);

        let trx = TrxHandle::new(self.clone());
        for cb in callbacks {
            match cb(&trx) {
                Ok(_) => {}
                Err(e) => return Err(TrxApplyErr::Other(e)),
            }
        }
        Ok(true)
    }

    fn dispatch_on_commit_hooks(&self) -> Vec<LocalBoxFuture<'_, ()>> {
        let mut guard = self.on_commit_hooks.try_lock().unwrap();
        let callbacks = mem::take(guard.deref_mut());
        drop(guard);
        callbacks.into_iter().filter_map(|f| f()).collect()
    }

    fn dispatch_post_commit_hooks(&self) -> Vec<LocalBoxFuture<'static, ()>> {
        let mut guard = self.on_post_commit_hooks.try_lock().unwrap();
        let callbacks = mem::take(guard.deref_mut());
        drop(guard);
        callbacks.into_iter().filter_map(|f| f()).collect()
    }
}

impl<B: Batchable> Inner<B> {
    fn check_status(&self) -> Result<(), TrxCheckErr> {
        if !self.is_pending_or_preparing() {
            Err(TrxCheckErr::ClosedForAddingOps)
        } else {
            Ok(())
        }
    }

    fn add_op(&self, op: B::Op) -> Result<(), BatchTrxOpErr> {
        match self.ops.try_lock() {
            Ok(mut ops) => {
                ops.push(op);
                self.counter.set(ops.len());
                Ok(())
            }
            Err(_) => Err(BatchTrxOpErr::ClosedForAddingOps),
        }
    }
}

impl<B: Batchable> Inner<B> {
    fn add_boxed_op(&self, future: TrxOppFuture<'static>) {
        self.scheduled.try_lock().unwrap().push(future);
    }
}

impl<B: Batchable> TrxRef<B> {
    pub fn upgrade(&self) -> Result<TrxHandle<B, Unknown>, TrxCheckErr> {
        let Some(inner) = self.0.upgrade() else {
            return Err(TrxCheckErr::Dropped);
        };

        Ok(TrxHandle::new(inner))
    }
    pub fn upgrade_checked(&self) -> Result<Ref<'_, TrxHandle<B, Open>>, TrxCheckErr> {
        let Some(inner) = self.0.upgrade() else {
            return Err(TrxCheckErr::Dropped);
        };
        inner.check_status()?;
        Ok(Ref::new(TrxHandle::new(inner)))
    }

    pub fn map<V>(&self, f: impl FnOnce(&'_ TrxHandle<B, Open>) -> V) -> Result<V, TrxCheckErr> {
        let txh = self.upgrade_checked()?;
        Ok(f(&txh))
    }
    pub fn run_checked(&self, f: impl FnOnce(&TrxHandle<B, Open>)) {
        if let Ok(txr) = self.upgrade_checked() {
            f(&txr)
        }
    }

    pub fn flatten_map<V>(
        &self,
        f: impl FnOnce(&TrxHandle<B>) -> Result<V, BatchTrxOpErr>,
    ) -> Result<V, BatchTrxOpErr> {
        let txh = self.upgrade_checked()?;
        f(&txh)
    }
}

pub enum TrxApplyErr {
    AccessDenied(String),
    Other(String),
    FailedCheck(TrxCheckErr),
}

#[derive(Debug)]
pub enum TrxCheckErr {
    ClosedForAddingOps,
    Dropped,
}
impl Display for TrxCheckErr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TrxCheckErr::ClosedForAddingOps => write!(
                f,
                "you can only add operations to a transaction that is pending or preparing"
            ),
            TrxCheckErr::Dropped => write!(f, "Transaction was dropped"),
        }
    }
}
impl From<TrxCheckErr> for String {
    fn from(value: TrxCheckErr) -> String {
        value.to_string()
    }
}

impl From<TrxCommitErr> for TrxApplyErr {
    fn from(value: TrxCommitErr) -> Self {
        match value {
            TrxCommitErr::Msg(msg) => TrxApplyErr::Other(msg),
        }
    }
}
impl From<BatchTrxOpErr> for TrxApplyErr {
    fn from(value: BatchTrxOpErr) -> Self {
        match value {
            BatchTrxOpErr::AccessDenied(msg) => TrxApplyErr::AccessDenied(msg),
            BatchTrxOpErr::Other(e) => TrxApplyErr::Other(e),
            BatchTrxOpErr::ClosedForAddingOps => {
                TrxApplyErr::Other(format!("Operation can not be added"))
            }
        }
    }
}

impl From<TrxCheckErr> for BatchTrxOpErr {
    fn from(value: TrxCheckErr) -> Self {
        BatchTrxOpErr::Other(value.to_string())
    }
}

#[cfg(test)]
mod test {
    use std::{
        borrow::Borrow,
        collections::{HashMap, HashSet},
        sync::Arc,
    };

    use futures::lock::Mutex;

    use super::{BatchTrxOpErr, FullOpenTrxHandle, Transaction, TrxCommitErr, TrxHandle};

    #[derive(Default, Clone)]
    struct DummyDB(Arc<Mutex<HashMap<String, i32>>>);

    impl DummyDB {
        pub async fn read(&self, key: impl Borrow<str>) -> Option<i32> {
            let db = self.0.lock().await;
            db.get(key.borrow()).cloned()
        }
        pub fn trx(&self, name: &str) -> Transaction<DummyDB> {
            Transaction::new(self.clone(), name)
        }
    }

    struct Batch {
        db: DummyDB,
        ops: Mutex<Vec<Op>>,
    }

    #[derive(Debug)]
    enum Op {
        Insert(DocumentRef, i32),
        Update(DocumentRef, i32),
        Delete(DocumentRef),
    }

    impl super::Batchable for DummyDB {
        type Child = Batch;
        type Op = Op;
        type TrxOp = Op;
        type Extras = ();

        fn child(&self) -> Result<Batch, String> {
            Ok(Batch {
                db: self.clone(),
                ops: Mutex::default(),
            })
        }
        fn insert(child: &Batch, op: Self::Op) {
            let mut ops = child.ops.try_lock().unwrap();
            ops.push(op);
        }
        fn process_trx_op(trx: FullOpenTrxHandle<Self>, op: Op) -> Result<(), BatchTrxOpErr> {
            trx.batch_operation(op)?;
            Ok(())
        }
        fn commit(child: &Batch) -> futures::future::LocalBoxFuture<'_, Result<(), TrxCommitErr>> {
            let fut = async {
                // checks if all the record references are valid
                let mut db = child.db.0.lock().await;
                let mut keys = HashSet::new();

                let ops = child.ops.try_lock().unwrap();
                for op in ops.iter() {
                    let key = match &op {
                        Op::Insert(doc, _) => {
                            let key = doc.path_ref.as_str();
                            if db.get(key).is_some() {
                                return Err(TrxCommitErr::Msg(format!(
                                    "INSERT: Record({key}) already exists"
                                )));
                            }
                            key
                        }
                        Op::Update(doc, _) => {
                            let key = doc.path_ref.as_str();
                            if db.get(key).is_none() {
                                return Err(TrxCommitErr::Msg(format!(
                                    "UPDATE: Record({key}) does not exists"
                                )));
                            }
                            key
                        }
                        Op::Delete(doc) => {
                            let key = doc.path_ref.as_str();
                            if db.get(key).is_none() {
                                return Err(TrxCommitErr::Msg(format!(
                                    "DELETE: Record({key}) does not exists"
                                )));
                            }
                            key
                        }
                    };
                    let is_inserted_for_first_time = keys.insert(key);
                    if !is_inserted_for_first_time {
                        return Err(TrxCommitErr::Msg(format!(
                            "BATCH: Record({key}) batch support only one operation per record"
                        )));
                    }
                }

                // commit operations
                for op in ops.iter() {
                    match &op {
                        Op::Insert(doc, val) => {
                            let key = doc.path_ref.as_str();
                            db.insert(key.to_string(), *val);
                        }
                        Op::Update(doc, val) => {
                            let key = doc.path_ref.as_str();
                            db.insert(key.to_string(), *val);
                        }
                        Op::Delete(doc) => {
                            let key = doc.path_ref.as_str();
                            db.remove(key);
                        }
                    };
                }
                Ok(())
            };
            Box::pin(fut)
        }

        fn trace_messages(_level: u8, messages: &[&dyn std::fmt::Display]) {
            for m in messages {
                log::info!("{m}")
            }
        }
    }

    #[derive(Debug)]
    struct DocumentRef {
        path_ref: String,
    }
    impl DocumentRef {
        pub fn new(path_ref: impl Into<String>) -> Self {
            Self {
                path_ref: path_ref.into(),
            }
        }
    }

    async fn insert_counter(
        trx: &TrxHandle<DummyDB>,
        id: impl Into<String>,
        val: i32,
    ) -> Result<(), BatchTrxOpErr> {
        // emulates JS process.nextTick()
        async {}.await;
        trx.process_op(Op::Insert(DocumentRef::new(id), val))?;
        Ok(())
    }
    async fn update_counter(
        trx: &TrxHandle<DummyDB>,
        id: impl Into<String>,
        val: i32,
    ) -> Result<(), BatchTrxOpErr> {
        // emulates JS process.nextTick()
        async {}.await;
        trx.process_op(Op::Update(DocumentRef::new(id), val))?;
        Ok(())
    }
    async fn delete_counter(
        trx: &TrxHandle<DummyDB>,
        id: impl Into<String>,
    ) -> Result<(), BatchTrxOpErr> {
        // emulates JS process.nextTick()
        async {}.await;
        trx.process_op(Op::Delete(DocumentRef::new(id)))?;
        Ok(())
    }
    #[tokio::test]
    async fn trx_example() {
        let db = DummyDB::default();

        // Initilize the counter
        let transaction = db.trx("first");
        {
            let txr = transaction.checked().unwrap();
            let _ = insert_counter(&txr, "counter1", 1).await;
            let _ = insert_counter(&txr, "counter2", 2).await;
        }

        assert_eq!(transaction.batch_counter(), 2);
        assert!(transaction.apply().await.is_ok());
        assert_eq!(db.read("counter1").await, Some(1));
        assert_eq!(db.read("counter2").await, Some(2));
        assert_eq!(db.read("counter3").await, None);

        // start editions, but fails because counter3 doesn't exist
        let trx = db.trx("second");
        {
            let trx = trx.checked().unwrap();
            let _ = update_counter(&trx, "counter2", 5).await;
            trx.add_op(|txh| async move {
                delete_counter(&txh, "counter3").await?;
                Ok(txh)
            });
        }
        assert!(trx.apply().await.is_err());
        assert_eq!(db.read("counter1").await, Some(1));
        assert_eq!(db.read("counter2").await, Some(2));
        assert_eq!(db.read("counter3").await, None);

        // Works
        let transaction = db.trx("second");
        let txr = transaction.get_ref();
        {
            let txh = txr.upgrade_checked().unwrap();
            let _ = update_counter(&txh, "counter2", 5).await;

            txh.add_op(|txh| async {
                insert_counter(&txh, "counter3", 3).await?;
                Ok(txh)
            });
            txh.add_op(|txh| async move {
                delete_counter(&txh, "counter1").await?;
                Ok(txh)
            });
        }

        assert!(transaction.apply().await.is_ok());
        assert_eq!(db.read("counter1").await, None);
        assert_eq!(db.read("counter2").await, Some(5));
        assert_eq!(db.read("counter3").await, Some(3));
    }
}
