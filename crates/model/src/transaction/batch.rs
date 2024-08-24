use super::FullOpenTrxHandle;
use futures::future::LocalBoxFuture;
use std::fmt::{Debug, Display};

/// A batch is an accumulator of db operations which will be committed at the end of a transaction.
/// Somtimes we might have more than one batch, depending on size limitations of the Batch impl
pub trait Batchable: Sized {
    /// Batch operation
    /// Could be an enum (insert, update, delete)
    /// or could be only callback
    type Op: Debug;

    type TrxOp: Debug;

    /// Extra data or metadata that will be stored in `Transaction`.
    /// In case it is not needed, it can be unit `()`
    type Extras: Default;

    /// Usually the weak reference to the DB Client
    type Child;

    const LIMIT: usize = 400;

    fn child(&self) -> Result<Self::Child, String>;
    fn insert(child: &Self::Child, op: Self::Op);
    fn commit(child: &Self::Child) -> LocalBoxFuture<'_, Result<(), TrxCommitErr>>;

    fn trace_messages(level: u8, messages: &[&dyn std::fmt::Display]);

    fn process_trx_op(trx: FullOpenTrxHandle<Self>, op: Self::TrxOp) -> Result<(), BatchTrxOpErr>;
}

#[derive(Debug)]
pub enum BatchTrxOpErr {
    AccessDenied(String),
    Other(String),
    ClosedForAddingOps,
}

impl From<String> for BatchTrxOpErr {
    fn from(value: String) -> Self {
        BatchTrxOpErr::Other(value)
    }
}

pub enum TrxCommitErr {
    Msg(String),
}

impl From<String> for TrxCommitErr {
    fn from(msg: String) -> Self {
        TrxCommitErr::Msg(msg)
    }
}
impl Display for TrxCommitErr {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TrxCommitErr::Msg(msg) => Display::fmt(msg, f),
        }
    }
}

impl From<TrxCommitErr> for BatchTrxOpErr {
    fn from(value: TrxCommitErr) -> Self {
        match value {
            TrxCommitErr::Msg(msg) => BatchTrxOpErr::Other(msg),
        }
    }
}
