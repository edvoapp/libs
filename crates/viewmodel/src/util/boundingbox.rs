use super::geometry::{PositionVector, Vector2D};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Debug, PartialEq, Clone)]
pub struct BoundingBox {
    pub top: f32,
    pub left: f32,
    pub bottom: f32,
    pub right: f32,
}

impl std::ops::Add<Vector2D> for BoundingBox {
    type Output = BoundingBox;
    fn add(self, other: Vector2D) -> Self::Output {
        BoundingBox {
            top: self.top + other.y,
            bottom: self.bottom + other.y,
            left: self.left + other.x,
            right: self.right + other.x,
        }
    }
}

impl std::ops::AddAssign<Vector2D> for BoundingBox {
    fn add_assign(&mut self, other: Vector2D) {
        self.top += other.y;
        self.bottom += other.y;
        self.left += other.x;
        self.right += other.x;
    }
}

#[wasm_bindgen]
impl BoundingBox {
    pub fn new(top: f32, left: f32, bottom: f32, right: f32) -> Self {
        Self {
            top,
            right,
            bottom,
            left,
        }
    }
    pub fn from_xyhw(x: f32, y: f32, height: f32, width: f32) -> Self {
        Self {
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
        }
    }
    pub fn y(&self) -> f32 {
        self.top
    }
    pub fn x(&self) -> f32 {
        self.left
    }
    pub fn width(&self) -> f32 {
        self.right - self.left
    }
    pub fn height(&self) -> f32 {
        self.bottom - self.top
    }
    pub fn position(&self) -> Vector2D {
        Vector2D {
            x: self.left,
            y: self.top,
        }
    }
    pub fn set_position(&mut self, position: PositionVector) {
        let width = self.width();
        let height = self.height();
        self.left = position.x;
        self.right = position.x + width;
        self.top = position.y;
        self.bottom = position.y + height;
    }
    pub fn intersects(&self, other: &BoundingBox) -> bool {
        !(other.top > self.bottom
            || other.bottom < self.top
            || other.right < self.left
            || other.left > self.right)
    }
    pub fn scale(&self, scale: f32) -> BoundingBox {
        BoundingBox {
            left: self.left * scale,
            top: self.top * scale,
            right: self.right * scale,
            bottom: self.bottom * scale,
        }
    }
    // TODO(SHOHEI): Is this supposed to return overlap amount? Add test cases for this.
    pub fn intersect(&self, other: &BoundingBox) -> Option<BoundingBox> {
        // largest of the start values
        let top = self.top.max(other.top);
        let left = self.left.max(other.left);

        // smallest of the end values
        let right = self.right.min(other.right);
        let bottom = self.bottom.min(other.bottom);

        // inversion (or equality) of the start/end means nonintersection
        if left >= right || top >= bottom {
            return None;
        }

        Some(BoundingBox {
            top,
            right,
            bottom,
            left,
        })
    }
    pub fn union(&self, other: &BoundingBox) -> BoundingBox {
        BoundingBox {
            left: self.left.min(other.left),
            top: self.top.min(other.top),
            right: self.right.max(other.right),
            bottom: self.bottom.max(other.bottom),
        }
    }
    // Map this box to the origin box, such that origin.left/top
    pub fn map_origin(&self, origin: &BoundingBox) -> BoundingBox {
        BoundingBox {
            left: self.left - origin.left,
            top: self.top - origin.top,
            right: self.right - origin.left,
            bottom: self.bottom - origin.top,
        }
    }
}

impl BoundingBox {
    pub fn center(&self) -> Vector2D {
        Vector2D {
            x: (self.left + self.right) / 2.0,
            y: (self.top + self.bottom) / 2.0,
        }
    }

    /// Returns the amount of overlap between two boxes.
    fn overlap_amount(&self, other: &BoundingBox) -> Vector2D {
        let BoundingBox {
            top: my_t,
            left: my_l,
            bottom: my_b,
            right: my_r,
        } = self;
        let BoundingBox {
            top: other_t,
            left: other_l,
            bottom: other_b,
            right: other_r,
        } = other;

        let mycenter = self.center();
        let mid_y = mycenter.y;
        let mid_x = mycenter.x;

        let min_t = other_t.max(*my_t);
        let max_t = other_b.min(mid_y);
        let min_b = other_t.max(mid_y);
        let max_b = other_b.min(*my_b);

        let min_l = other_l.max(*my_l);
        let max_l = other_r.min(mid_x);
        let min_r = other_l.max(mid_x);
        let max_r = other_r.min(*my_r);

        let l_overlap = if max_l > min_l { max_l - min_l } else { 0.0 };
        let r_overlap = if max_r > min_r { max_r - min_r } else { 0.0 };

        let t_overlap = if max_t > min_t { max_t - min_t } else { 0.0 };
        let b_overlap = if max_b > min_b { max_b - min_b } else { 0.0 };

        let total_x_overlap = r_overlap + l_overlap;
        let total_y_overlap = t_overlap + b_overlap;

        Vector2D {
            x: total_x_overlap,
            y: total_y_overlap,
        }
    }

    /// Returns the vector that should be applied to this box to deconflict it from another box.
    /// Note that this method picks a single axis between x and y to deconflict on.
    pub fn single_axis_deconfliction_vector(
        &self,
        other: &BoundingBox,
        other_is_junior: bool,
    ) -> Vector2D {
        let Vector2D {
            x: total_x_overlap,
            y: total_y_overlap,
        } = self.overlap_amount(other);
        let direction = (self.center() - other.center()).signum();

        if self == other {
            if other_is_junior {
                return Vector2D {
                    x: -total_x_overlap,
                    y: 0.0,
                };
            } else {
                return Vector2D {
                    x: total_x_overlap,
                    y: 0.0,
                };
            }
        }

        // Imagine the following scenario; B overlaps A and B is junior to A.
        //     _________________
        //    |       |//|      |
        //    |    A  |//|  B   |
        //    |       |//|      |
        //    |_______|__|______|
        //
        // In this scenario, we want B to move right, not down.
        // That means that (Bwidth:overlapA)/(Bwidth) must be smaller than or
        // equal to (Bheight:overlapA)/(Bheight), hence the following condition.
        if total_x_overlap / self.width() <= total_y_overlap / self.height() {
            Vector2D {
                x: total_x_overlap,
                y: 0.0,
            } * direction
        } else {
            Vector2D {
                x: 0.0,
                y: total_y_overlap,
            } * direction
        }
    }

    /// Returns the buoyant force between two overlapping boxes as if one was a "cube" of water in zero-g
    /// (ignoring surface tension) and the other was a hollow "cube".
    /// The returned vector is the force that this box should feel by overlapping the other object.
    pub fn buoyant_force(&self, other: &BoundingBox, other_is_junior: bool) -> Vector2D {
        let Vector2D {
            x: total_x_overlap,
            y: total_y_overlap,
        } = self.overlap_amount(other);

        if self == other {
            if other_is_junior {
                return Vector2D {
                    x: -total_x_overlap,
                    y: -total_y_overlap,
                };
            } else {
                return Vector2D {
                    x: total_x_overlap,
                    y: total_y_overlap,
                };
            }
        }

        // Unit vector from the center of this box to the center of the other box
        let unit_vu = (self.center() - other.center()).normalize();

        // for a given y overlap, a greater y-force should be felt for a higher x overlap (and vice versa)
        // BUT if we simply multiply the forces by each other then they'll both be identical - we don't want that.
        // So instead, lets apply a scaled perpendicular force to ensure the two dimensions are differentiated (and not too high of magnitude)

        Vector2D {
            x: total_x_overlap,
            y: total_y_overlap,
        } * unit_vu
    }
}

#[cfg(test)]
mod test {
    use super::BoundingBox;
    use crate::geometry::Vector2D;

    #[test]
    fn xyhw() {
        assert_eq!(
            BoundingBox::new(-200.0, -200.0, -100.0, -100.0),
            BoundingBox::from_xyhw(-200.0, -200.0, 100.0, 100.0)
        );
    }
    #[test]
    fn clipping1() {
        let vprt1 = BoundingBox::from_xyhw(0.0, 0.0, 100.0, 100.0);
        let vprt2 = BoundingBox::from_xyhw(-200.0, -200.0, 100.0, 100.0);
        let outside_card_lesser = BoundingBox::from_xyhw(-400.0, -400.0, 50.0, 50.0);
        let outside_card_greater = BoundingBox::from_xyhw(200.0, 200.0, 50.0, 50.0);

        assert_eq!(
            vprt1.map_origin(&outside_card_greater),
            BoundingBox::from_xyhw(-200.0, -200.0, 100.0, 100.0)
        );

        assert_eq!(
            vprt2.map_origin(&outside_card_lesser),
            BoundingBox::from_xyhw(200.0, 200.0, 100.0, 100.0)
        );

        assert_eq!(
            vprt2.map_origin(&outside_card_greater),
            BoundingBox::from_xyhw(-400.0, -400.0, 100.0, 100.0)
        );
    }

    #[test]
    #[rustfmt::skip]
    // TODO(SHOHEI): These test might fail. Fix it.
    fn test_buoyant_force_y() {
        let a = BoundingBox::from_xyhw(0.0, 0.0, 10.0, 10.0);

        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0, -10.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  0.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -9.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -1.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -8.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -2.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -7.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -3.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -6.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -4.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -5.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -5.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -4.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -4.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -3.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -3.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -2.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -2.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  -1.0, 10.0, 10.0), false), Vector2D { x: 0.0, y: -1.0 });

        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   0.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  0.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   1.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  1.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   2.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  2.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   3.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  3.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   4.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  4.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   5.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  5.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   6.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  4.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   7.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  3.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   8.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  2.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,   9.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  1.0 });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(0.0,  10.0, 10.0, 10.0), false), Vector2D { x: 0.0, y:  0.0 });
    }

    #[test]
    #[rustfmt::skip]
    // TODO(SHOHEI): These test might fail. Fix it.
    fn test_buoyant_force_x() {
        let a = BoundingBox::from_xyhw(0.0, 0.0, 10.0, 10.0);

        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(-10.0, 0.0, 10.0, 10.0), false), Vector2D { x:  0.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -9.0, 0.0, 10.0, 10.0), false), Vector2D { x: -1.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -8.0, 0.0, 10.0, 10.0), false), Vector2D { x: -2.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -7.0, 0.0, 10.0, 10.0), false), Vector2D { x: -3.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -6.0, 0.0, 10.0, 10.0), false), Vector2D { x: -4.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -5.0, 0.0, 10.0, 10.0), false), Vector2D { x: -5.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -4.0, 0.0, 10.0, 10.0), false), Vector2D { x: -4.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -3.0, 0.0, 10.0, 10.0), false), Vector2D { x: -3.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -2.0, 0.0, 10.0, 10.0), false), Vector2D { x: -2.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( -1.0, 0.0, 10.0, 10.0), false), Vector2D { x: -1.0, y: 0.0, });
     
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  0.0, 0.0, 10.0, 10.0), false), Vector2D { x:  0.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  1.0, 0.0, 10.0, 10.0), false), Vector2D { x:  1.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  2.0, 0.0, 10.0, 10.0), false), Vector2D { x:  2.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  3.0, 0.0, 10.0, 10.0), false), Vector2D { x:  3.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  4.0, 0.0, 10.0, 10.0), false), Vector2D { x:  4.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  5.0, 0.0, 10.0, 10.0), false), Vector2D { x:  5.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  6.0, 0.0, 10.0, 10.0), false), Vector2D { x:  4.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  7.0, 0.0, 10.0, 10.0), false), Vector2D { x:  3.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  8.0, 0.0, 10.0, 10.0), false), Vector2D { x:  2.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw(  9.0, 0.0, 10.0, 10.0), false), Vector2D { x:  1.0, y: 0.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( 10.0, 0.0, 10.0, 10.0), false), Vector2D { x:  0.0, y: 0.0, });
    }

    #[test]
    fn test_buoyant_force_half_overlapped() {
        let a = BoundingBox::from_xyhw(0.0, 0.0, 10.0, 10.0);
        let b = BoundingBox {
            top: 0.0,
            left: 5.0,
            bottom: 10.0,
            right: 15.0,
        };
        assert_eq!(a.buoyant_force(&b, false), Vector2D { x: 5.0, y: 0.0 });
    }

    #[test]
    #[rustfmt::skip]
    fn area_difference() {
        let a = BoundingBox::from_xyhw(0.0, 0.0, 10.0, 10.0);

        // Two scenarios, both of which start with the same y overlap (5) and both of which should push `a` down (+y)
        // Healthy x overlap
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( 5.0, -5.0, 10.0, 10.0), false), Vector2D { x:  25.0, y: -25.0, });
        assert_eq!(a.buoyant_force(&BoundingBox::from_xyhw( 9.0, -5.0, 10.0, 10.0), false), Vector2D { x:  5.0, y: -5.0, /* this one should be less */  });
    }

    #[test]
    #[rustfmt::skip]
    fn test_deconfliction_two_boxes_percectly_on_top_of_each_other() {
        let a = BoundingBox::from_xyhw(0.0, 0.0, 10.0, 10.0);
        let b = BoundingBox::from_xyhw(0.0, 0.0, 10.0, 10.0);

        assert_eq!(a.single_axis_deconfliction_vector(&b, false), Vector2D { x: 10.0, y: 0.0 });
        assert_eq!(a.single_axis_deconfliction_vector(&b, true), Vector2D { x: -10.0, y: 0.0 });
    }
}
