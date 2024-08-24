use super::ForceVector;
use wasm_bindgen::prelude::*;

#[derive(Default, Clone, Copy, Debug, PartialEq)]
#[wasm_bindgen]
pub struct Vector2D {
    pub x: f32,
    pub y: f32,
}
impl std::ops::Add<f32> for Vector2D {
    type Output = Self;
    fn add(self, other: f32) -> Self::Output {
        Self {
            x: self.x + other,
            y: self.y + other,
        }
    }
}
impl std::ops::Add<Vector2D> for Vector2D {
    type Output = Self;
    fn add(self, other: Self) -> Self::Output {
        Self {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }
}
impl std::ops::AddAssign<Vector2D> for Vector2D {
    fn add_assign(&mut self, other: Self) {
        self.x += other.x;
        self.y += other.y;
    }
}
impl std::ops::Sub<Vector2D> for Vector2D {
    type Output = Self;
    fn sub(self, other: Self) -> Self::Output {
        Self {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}
impl std::ops::SubAssign<Vector2D> for Vector2D {
    fn sub_assign(&mut self, other: Self) {
        self.x -= other.x;
        self.y -= other.y;
    }
}
impl std::ops::Mul<f32> for Vector2D {
    type Output = Self;
    fn mul(self, mult: f32) -> Self::Output {
        Self {
            x: self.x * mult,
            y: self.y * mult,
        }
    }
}
impl std::ops::MulAssign<f32> for Vector2D {
    fn mul_assign(&mut self, mult: f32) {
        self.x *= mult;
        self.y *= mult;
    }
}
impl std::ops::Mul<Vector2D> for Vector2D {
    type Output = Self;
    fn mul(self, mult: Self) -> Self::Output {
        Self {
            x: self.x * mult.x,
            y: self.y * mult.y,
        }
    }
}
impl std::ops::Div<f32> for Vector2D {
    type Output = Self;
    fn div(self, div: f32) -> Self::Output {
        Self {
            x: self.x / div,
            y: self.y / div,
        }
    }
}
impl std::ops::Div<Vector2D> for Vector2D {
    type Output = Self;
    fn div(self, div: Self) -> Self::Output {
        Self {
            x: self.x / div.x,
            y: self.y / div.y,
        }
    }
}
impl std::ops::Neg for Vector2D {
    type Output = Self;
    fn neg(self) -> Self::Output {
        Self {
            x: -self.x,
            y: -self.y,
        }
    }
}
impl std::fmt::Display for Vector2D {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "(x: {:.3}, y: {:.3})", self.x, self.y)
    }
}

impl Vector2D {
    pub fn zeros() -> Self {
        Self { x: 0.0, y: 0.0 }
    }
    pub fn ones() -> Self {
        Self { x: 1.0, y: 1.0 }
    }
    pub fn infs() -> Self {
        Self {
            x: f32::INFINITY,
            y: f32::INFINITY,
        }
    }
    pub fn map<F: Fn(f32) -> f32>(&self, f: F) -> Self {
        Self {
            x: f(self.x),
            y: f(self.y),
        }
    }
    pub fn magnitude(&self) -> f32 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
    pub fn distance(&self, other: &Self) -> f32 {
        (*other - *self).magnitude()
    }
    pub fn xy_slope(&self) -> f32 {
        self.y / self.x
    }
    pub fn vec_slope(&self, prev: &Self, f_curr: ForceVector, f_prev: ForceVector) -> Self {
        (f_curr - f_prev) / (*self - *prev).magnitude()
    }
    pub fn normalize(&self) -> Self {
        let mag = self.magnitude();
        *self / mag
    }
    pub fn x_hot(&self) -> Self {
        if self.x > self.y {
            Self { x: 1.0, y: 0.1 }
        } else {
            Self { x: 0.1, y: 1.0 }
        }
    }
    pub fn min_hot(&self) -> Self {
        if self.x < self.y {
            Self { x: 1.0, y: 0.0 }
        } else {
            Self { x: 0.0, y: 1.0 }
        }
    }
    pub fn max_hot(&self) -> Self {
        if self.x > self.y {
            Self { x: 1.0, y: 0.0 }
        } else {
            Self { x: 0.0, y: 1.0 }
        }
    }
    pub fn abs(&self) -> Self {
        Self {
            x: self.x.abs(),
            y: self.y.abs(),
        }
    }
    pub fn clamp(&self, min: f32, max: f32) -> Self {
        Self {
            x: self.x.clamp(min, max),
            y: self.y.clamp(min, max),
        }
    }
    pub fn signum(&self) -> Self {
        Self {
            x: self.x.signum(),
            y: self.y.signum(),
        }
    }
    pub fn sign_preserving_powf(&self, pow: f32) -> Self {
        Self {
            x: self.x.abs().powf(pow) * self.x.signum(),
            y: self.y.abs().powf(pow) * self.y.signum(),
        }
    }
    pub fn div_safe(&self, other: &Self) -> Self {
        Self {
            x: if other.x == 0.0 {
                0.0
            } else {
                self.x / other.x
            },
            y: if other.y == 0.0 {
                0.0
            } else {
                self.y / other.y
            },
        }
    }
    pub fn hot(&self) -> f32 {
        self.x.max(self.y)
    }
    pub fn max(&self, other: Vector2D) -> Self {
        Self {
            x: self.x.max(other.x),
            y: self.y.max(other.y),
        }
    }
}
