use super::{Batchable, Transaction, TrxHandle, TrxRef, Unknown};
use std::{cell::RefCell, fmt::Debug, sync::Arc};

pub struct ActiveTrxStore<B: Batchable>(Arc<Inner<B>>);
struct Inner<B: Batchable> {
    set: RefCell<Vec<TrxRef<B>>>,
}

impl<B: Batchable> Default for Inner<B> {
    fn default() -> Self {
        Self {
            set: Default::default(),
        }
    }
}
impl<B: Batchable> PartialEq for ActiveTrxStore<B> {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}
impl<B: Batchable> Eq for ActiveTrxStore<B> {}
impl<B: Batchable> Debug for ActiveTrxStore<B> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_tuple("ActiveTrxStore").finish()
    }
}

impl<B: Batchable> Clone for ActiveTrxStore<B> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<B: Batchable> Default for ActiveTrxStore<B> {
    fn default() -> Self {
        Self(Default::default())
    }
}

impl<B: Batchable> ActiveTrxStore<B> {
    pub fn add(&self, transaction: &Transaction<B>) {
        self.0.set.borrow_mut().push(transaction.get_ref());
    }

    pub fn remove_by_id(&self, id: &str) {
        let mut set = self.0.set.borrow_mut();
        set.retain(|weak| match weak.upgrade() {
            Ok(trx) => trx.name() == id,
            Err(_) => false,
        })
    }

    pub fn clean_inactive(&self) {
        let mut set = self.0.set.borrow_mut();
        set.retain(|weak| weak.upgrade().is_ok())
    }

    pub fn count(&self) -> u32 {
        let set = self.0.set.borrow();
        set.len() as u32
    }

    pub fn map<T>(&self, mut f: impl FnMut(&TrxHandle<B, Unknown>) -> T) -> Vec<T> {
        let mut set = self.0.set.borrow_mut();
        let mut list = Vec::new();
        set.retain(|weak: &TrxRef<B>| match weak.upgrade() {
            Ok(trx) => {
                list.push(f(&trx));
                true
            }
            Err(_) => false,
        });
        list
    }
}
