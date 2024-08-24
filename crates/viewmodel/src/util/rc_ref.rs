use std::ops::Deref;
use std::rc::Rc;

/// `RcRef` wraps an `Rc` to prevent the developer to clone the Rc
/// and only using it as a reference.
pub struct RcRef<T>(Rc<T>);

impl<T> Deref for RcRef<T> {
    type Target = T;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl<T> AsRef<T> for RcRef<T> {
    fn as_ref(&self) -> &T {
        &self.0
    }
}

impl<T> From<Rc<T>> for RcRef<T> {
    fn from(value: Rc<T>) -> Self {
        RcRef(value)
    }
}
