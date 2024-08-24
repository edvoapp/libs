/// Perform a linear interpolation between a and b for a ratio between 0.0 and 1.0
pub(crate) fn lerp(a: f32, b: f32, ratio: f32) -> f32 {
    a * (1.0 - ratio) + b * ratio
}
