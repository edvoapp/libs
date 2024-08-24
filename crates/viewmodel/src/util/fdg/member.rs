use super::FdgPhase;
use crate::{
    boundingbox::BoundingBox,
    fdg::{CARD_DEFAULT_SIZE, MARGIN},
    geometry::{PositionVector, Vector2D},
};

use std::{
    cell::{Ref, RefCell, RefMut},
    rc::{Rc, Weak},
};

use observable_react::JsObservable;
use observable_rs::Observable;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MemberMeta {
    pub width: Option<f32>,
    pub height: Option<f32>,
    pub autoposition: bool,
    pub x: Option<f32>,
    pub y: Option<f32>,
    pub _left_align: bool,
}

#[wasm_bindgen]
impl MemberMeta {
    pub fn init(
        width: Option<f32>,
        height: Option<f32>,
        autoposition: bool,
        x: Option<f32>,
        y: Option<f32>,
        _left_align: bool,
    ) -> Self {
        Self {
            width,
            height,
            autoposition,
            x,
            y,
            _left_align,
        }
    }
}

#[wasm_bindgen(js_name = VM_Member)]
#[derive(Clone)]
pub struct Member(Rc<InnerMember>);
impl std::cmp::PartialEq for Member {
    fn eq(&self, other: &Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}
impl std::cmp::PartialEq<&Member> for Member {
    fn eq(&self, other: &&Self) -> bool {
        Rc::ptr_eq(&self.0, &other.0)
    }
}
impl std::ops::Deref for Member {
    type Target = InnerMember;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

#[wasm_bindgen(js_class = VM_Member)]
impl Member {
    #[wasm_bindgen(getter, js_name = "bbox")]
    pub fn js_bbox(&self) -> JsObservable {
        self.0.bbox.reader().into()
    }
    pub fn coordinates(&self) -> Vector2D {
        self.0.state.borrow().bbox.position()
    }
    pub fn num_of_relations(&self) -> usize {
        self.0.state.borrow().relations.len()
    }
    pub fn set_meta(
        &self,
        x: Option<f32>,
        y: Option<f32>,
        height: Option<f32>,
        width: Option<f32>,
        autoposition: Option<bool>,
    ) {
        {
            let mut state = self.0.state.borrow_mut();
            let margin = 2.0 * MARGIN;
            let x = x.unwrap_or(0.0);
            let y = y.unwrap_or(0.0);
            let height = height.unwrap_or(CARD_DEFAULT_SIZE) + margin;
            let width = width.unwrap_or(CARD_DEFAULT_SIZE) + margin;
            state.bbox = BoundingBox::from_xyhw(x, y, height, width);

            if let Some(ap) = autoposition {
                state.autoposition = ap;
            }

            drop(state);
        }
        self.commit_bbox();
    }
    pub fn update_coordinates(&self, x: f32, y: f32) {
        let mut state = self.0.state.borrow_mut();
        state.bbox.left = x;
        state.bbox.top = y;
    }
}

impl Member {
    pub fn new(state: MemberState, id: usize) -> Self {
        Self(Rc::new(InnerMember {
            id,
            bbox: Observable::new(state.bbox.clone()),
            state: RefCell::new(state),
        }))
    }

    pub fn set_position(&self, position: PositionVector) {
        let mut state = self.0.state.borrow_mut();
        state.bbox.set_position(position);
    }

    pub fn commit_bbox(&self) {
        if let Ok(me) = self.0.state.try_borrow() {
            self.0.bbox.set(me.bbox.clone());
        };
    }

    pub fn position(&self) -> Vector2D {
        self.0.state.borrow().bbox.position()
    }

    pub fn plot_x(&self, s: &'static str) {
        let bbox = &self.0.state.borrow().bbox;
        println!(
            "  {}| {}, {} ({s})",
            "　".repeat((bbox.left / 25.0) as usize),
            bbox.left,
            bbox.top
        );
    }

    pub fn relations_ref(&self) -> Ref<Vec<Relation>> {
        self.0.relations_ref()
    }

    pub fn get_target_index_in_relations(&self, target: &Member) -> Option<usize> {
        let id = target.id;
        self.relations_ref()
            .iter()
            .position(|r| match r.target.upgrade() {
                Some(m) => m.id == id,
                None => false,
            })
    }

    pub fn state_refmut(&self) -> RefMut<MemberState> {
        self.0.state.borrow_mut()
    }

    pub fn inner(&self) -> Rc<InnerMember> {
        self.0.clone()
    }
}

pub struct InnerMember {
    pub id: usize,
    pub bbox: Observable<BoundingBox>,
    pub state: RefCell<MemberState>,
}

impl InnerMember {
    /// The sum of all forces imparted on this member by its relationships
    /// as modeled by "rubber bands" (and springs, to be discussed later).
    pub fn force_vector(
        &self,
        position: PositionVector,
        all_members: &[Member],
        phase: &FdgPhase,
    ) -> Vector2D {
        // We're doing a lot of borrows, which ain't great
        let state = self.state.borrow();
        let relations = &state.relations;
        let bbox = BoundingBox::from_xyhw(
            position.x,
            position.y,
            state.bbox.height(),
            state.bbox.width(),
        );
        let center = bbox.center();

        let mut repulsion = Vector2D::zeros();
        let mut attraction = Vector2D::zeros();

        if let FdgPhase::AttractRepel = phase {
            // Calculate repulsive forces
            for other in all_members {
                let other_bbox = &other.bbox();
                if self.id == other.id || !bbox.intersects(other_bbox) || !state.autoposition {
                    continue;
                }

                let other_is_junior = other.id > self.id;

                // TODO(SHOHEI): check if there's any circular relationship
                // I think we should detect circular relationship so that we can apply
                // an appropriate force. For instance, if there's a circular relationship,
                // I think it makes sense to use buoyant_force instead of single_axis_deconfliction_vector.
                let circular_relationship = false;

                // TODO: Use either single_axis_deconfliction_vector or buoyant_force here. Dealer's choice,
                // but don't change their implementation to suit our needs here. Just choose which one.
                let repulsive_force = if circular_relationship {
                    bbox.buoyant_force(other_bbox, other_is_junior)
                } else {
                    bbox.single_axis_deconfliction_vector(other_bbox, other_is_junior)
                };

                // TODO: Use exponentiation or multiplication or if-gating to make repulsion stronger than attraction,
                // but if repulsive force has a minor component, how to we prevent that from overriding the attraction?
                //  - If we are using single_axis_deconfliction_vector, then there is no minor component to compete.
                //  - If we are using buoyant, that might be an issue.
                repulsion += repulsive_force * 1_000_000.0;
                // repulsion +=
                //     repulsive_force.abs().map(convert_to_logistic_force) * repulsive_force.signum();
            }
        }

        // Calculate attractive forces
        for other in relations.iter().filter_map(|r| r.target.upgrade()) {
            let other_bbox = other.bbox();
            let other_center = other_bbox.center();
            let attractive_force = other_center - center; // force gets stronger as its further away

            match phase {
                FdgPhase::Attract | FdgPhase::AttractRepel => {
                    // attraction += attractive_force;
                    attraction += attractive_force.sign_preserving_powf(1.2);
                }
            }
        }

        repulsion + attraction
    }

    fn bbox(&self) -> BoundingBox {
        self.state.borrow().bbox.clone()
    }

    fn relations_ref(&self) -> Ref<Vec<Relation>> {
        Ref::map(self.state.borrow(), |m| &m.relations)
    }
}

pub struct MemberState {
    pub bbox: BoundingBox,
    pub autoposition: bool,
    pub relations: Vec<Relation>,
}

pub struct Relation {
    pub target: Weak<InnerMember>,
}
impl std::cmp::PartialEq for Relation {
    fn eq(&self, other: &Self) -> bool {
        Weak::ptr_eq(&self.target, &other.target)
    }
}
impl Relation {
    pub fn member(&self) -> Member {
        Member(Weak::upgrade(&self.target).unwrap())
    }
}

/// Calculates the desired distance between two vertices (centers of boxes).
pub fn desired_d(box1: &BoundingBox, box2: &BoundingBox, slope: f32, direction_v: Vector2D) -> f32 {
    let Vector2D { x, y } = direction_v.abs();
    if slope.abs() < 1.0 {
        let theta = (y / x).atan();
        (box1.width() + box2.width()) / 2.0 / theta.cos()
    } else {
        let theta = (x / y).atan();
        (box1.height() + box2.height()) / 2.0 / theta.cos()
    }
}

// Only used in examples
pub struct CoordForce {
    pub coord: f32, // x component of the gradient calc
    pub force: f32, // y component of the gradient calc
}

// TODO write tests for this to verify that the shape of the force is:
// ___ strongly left
//    \ _ zero is here
//     \__ strongly right
#[allow(unused)]
fn convert_to_logistic_force(x: f32) -> f32 {
    let l: f32 = 2000.0;
    let k: f32 = 105.0;
    let x0: f32 = 1.0;
    l / (1.0 + f32::exp(-k * (x - x0)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_convert_to_logistic_force() {
        assert!(convert_to_logistic_force(0.0) == 0.0);
        assert!(convert_to_logistic_force(0.1) < 0.1);
        assert!(convert_to_logistic_force(0.2) < 0.1);
        assert!(convert_to_logistic_force(0.3) < 0.1);
        assert!(convert_to_logistic_force(0.4) < 0.1);
        assert!(convert_to_logistic_force(0.5) < 0.1);
        assert!(convert_to_logistic_force(0.6) < 0.1);
        assert!(convert_to_logistic_force(0.7) < 0.1);
        assert!(convert_to_logistic_force(0.8) < 0.1);
        assert!(convert_to_logistic_force(0.9) < 0.1);

        assert!(convert_to_logistic_force(1.0) == 1000.0);
        assert!((2000.0 - convert_to_logistic_force(2.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(3.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(4.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(5.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(6.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(7.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(8.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(9.0)) < 1e-6);
        assert!((2000.0 - convert_to_logistic_force(10.0)) < 1e-6);
    }
}
