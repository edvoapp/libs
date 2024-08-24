use std::{
    rc::Rc,
    sync::atomic::{AtomicU32, Ordering},
};

use super::math::lerp;

#[derive(Clone)]
pub struct Animator(Rc<Inner>);

struct Inner {
    frames: u32,
    frame: AtomicU32,
    start: f32,
    end: f32,
}

impl Animator {
    pub fn new(seconds: f32, start: f32, end: f32) -> Self {
        Self(Rc::new(Inner {
            frames: ((seconds * 60.0) as u32).max(1), // assuming framerate
            frame: 0.into(),
            start,
            end,
        }))
    }

    /// Inert this animator so that if `step()` gets called, it will return `None`.
    pub fn cancel(&self) {
        self.0.frame.store(self.0.frames, Ordering::SeqCst);
    }

    pub fn step(&self) -> Option<f32> {
        let inner = &self.0;
        let frame = inner.frame.fetch_add(1, Ordering::SeqCst);
        if frame > inner.frames {
            None
        } else {
            let ratio = frame as f32 / self.0.frames as f32;
            Some(lerp(inner.start, inner.end, ratio))
        }
    }

    pub fn current(&self) -> f32 {
        let Inner {
            frames,
            frame,
            start,
            end,
        } = &*self.0;
        let frame = frame.load(Ordering::SeqCst);
        let ratio = frame as f32 / *frames as f32;
        lerp(*start, *end, ratio)
    }
}

#[cfg(test)]
mod test {
    use super::Animator;

    macro_rules! assert_delta {
        ($x:expr, $y:expr, $d:expr) => {
            if ($x - $y).abs() >= $d {
                panic!();
            }
        };
    }

    #[test]
    fn basic() {
        let a = Animator::new(0.2, 0.0, 0.1);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_delta!(a.step().unwrap(), 0.0833333, f32::EPSILON);
        assert_eq!(a.step(), None);
    }
}
