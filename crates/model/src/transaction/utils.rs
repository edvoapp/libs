use std::{ops::Deref, task::Poll};

use futures::{future::MaybeDone, lock::Mutex, Future, FutureExt};

pub fn intersection<T: PartialEq<T>>(a: &[T], b: &[T]) -> bool {
    a.iter().any(|x| b.contains(x))
}

#[cfg(test)]
mod test {
    use crate::transaction::{intersection, TrxState};

    #[test]
    fn intersection_test() {
        use TrxState::*;

        assert!(intersection(
            &[Pending, Preparing],
            &[Failed, Preparing, Committed]
        ));
        assert!(!intersection(
            &[Pending, Preparing],
            &[Failed, Committing, Committed]
        ));
    }
}

#[derive(Default)]
pub struct MutexCell<T: Copy>(Mutex<T>);

impl<T: Copy> MutexCell<T> {
    pub fn new(value: T) -> Self {
        Self(Mutex::new(value))
    }
    pub fn get(&self) -> T {
        let guard = self.0.try_lock().unwrap();
        *guard
    }
    pub fn set(&self, value: T) -> T {
        let mut guard = self.0.try_lock().unwrap();
        *guard = value;
        *guard
    }
}

pub struct FutureGroup<F> {
    in_progress: Vec<F>,
}

impl<F: Future + Unpin> Future for FutureGroup<F> {
    type Output = ();

    fn poll(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> std::task::Poll<Self::Output> {
        let in_progress = &mut self.in_progress;

        in_progress.retain_mut(|fut| fut.poll_unpin(cx).is_pending());
        if in_progress.is_empty() {
            Poll::Ready(())
        } else {
            Poll::Pending
        }
    }
}

pub fn process_all<I>(iter: I) -> FutureGroup<I::Item>
where
    I: IntoIterator,
    I::Item: Future,
{
    FutureGroup {
        in_progress: iter.into_iter().collect(),
    }
}

pub trait FutureExtUtils: Future + Sized {
    fn run_meanwhile<F: Future + Unpin>(self, other: F) -> FutureUntil<F, Self> {
        FutureUntil {
            other: MaybeDone::Future(other),
            main: self,
        }
    }

    fn run_until<F: Future + Unpin>(self, other: F) -> FutureUntil<Self, F> {
        FutureUntil {
            other: MaybeDone::Future(self),
            main: other,
        }
    }
}

pub struct FutureUntil<F1: Future, F2> {
    other: MaybeDone<F1>,
    main: F2,
}

impl<F1, F2> Future for FutureUntil<F1, F2>
where
    F1: Future + Unpin,
    F2: Future + Unpin,
{
    type Output = F2::Output;

    fn poll(
        mut self: std::pin::Pin<&mut Self>,
        cx: &mut std::task::Context<'_>,
    ) -> Poll<Self::Output> {
        let _ = self.other.poll_unpin(cx);
        self.main.poll_unpin(cx)
    }
}

pub struct Ref<'a, T: 'a> {
    val: T,
    phantom: std::marker::PhantomData<&'a T>,
}
impl<'a, T: 'a> Deref for Ref<'a, T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.val
    }
}
impl<'a, T: 'a> Ref<'a, T> {
    pub fn new(val: T) -> Self {
        Self {
            val,
            phantom: Default::default(),
        }
    }
}
