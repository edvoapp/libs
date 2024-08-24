use std::{
    cell::{Ref, RefCell},
    rc::Rc,
};

use super::{Member, MemberMeta, MemberState, Relation};
use crate::{
    boundingbox::BoundingBox,
    geometry::{PositionVector, Vector2D},
};

use edvo_model::timer::{CallbackTimer, IntervalTimer};
use observable_react::JsObservable;
use observable_rs::Observable;
use rand::{thread_rng, Rng};
use wasm_bindgen::prelude::*;

pub const CARD_DEFAULT_SIZE: f32 = 300.0;
pub const MARGIN: f32 = 20.0;
const ANIMATE_STEP_MS: u32 = 20;
const MAX_ITERS: usize = 100;
const INITIAL_STEP_SIZE: f32 = 10.0;
const MAX_STEP: f32 = 100.0;
const MIN_STEP: f32 = 1.0; // minimum learning rate to prevent it from becoming too small
const NUDGE_VALUE: f32 = 1.0;

#[derive(Clone, Copy, Debug)]
pub enum FdgPhase {
    Attract,
    AttractRepel,
}

#[derive(Default)]
struct State {
    pub members: Vec<Member>,
    pub fdg_in_progress: Observable<bool>,
    member_counter: usize,
    animator: Option<IntervalTimer>,
    debounce_timeout: RefCell<Option<CallbackTimer>>,
}
impl State {}

#[wasm_bindgen(js_name = VM_Graph)]
#[derive(Clone, Default)]
pub struct Graph(Rc<RefCell<State>>);

#[wasm_bindgen(js_class = VM_Graph)]
impl Graph {
    /// Initializes a new graph.
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds a new member (vertex) to the graph.
    pub fn new_member(
        &mut self,
        MemberMeta {
            width,
            height,
            autoposition,
            x,
            y,
            ..
        }: MemberMeta,
    ) -> Member {
        let mut inner = self.0.borrow_mut();
        let mut rng = thread_rng();

        let x = x.unwrap_or_else(|| 500.0 * inner.member_counter as f32 - MARGIN);
        let y = y.unwrap_or_else(|| rng.gen_range(0f32..=750f32).round() - MARGIN);

        let margin = 2.0 * MARGIN;
        let width = width.unwrap_or(CARD_DEFAULT_SIZE) + margin;
        let height = height.unwrap_or(CARD_DEFAULT_SIZE) + margin;
        let bbox = BoundingBox::from_xyhw(x, y, height, width);

        let state = MemberState {
            bbox,
            autoposition,
            relations: Vec::new(),
        };

        let member = Member::new(state, inner.member_counter);

        inner.member_counter += 1;
        inner.members.push(member.clone());

        member
    }

    /// Removes a member (vertex) from the graph.
    pub fn remove_member(&self, member: &Member) {
        let mut state = self.0.borrow_mut();
        if let Some(index) = state.members.iter().position(|m| m.id == member.id) {
            state.members.remove(index);
        }
    }

    /// Creates a relation (edge) between two members (vertices).
    pub fn relate(&self, from: &Member, to: &Member) {
        from.state_refmut().relations.push(Relation {
            target: Rc::downgrade(&to.inner()),
        });
        to.state_refmut().relations.push(Relation {
            target: Rc::downgrade(&from.inner()),
        });
    }

    /// Breaks a relation (edge) between two members (vertices).
    pub fn unrelate(&self, from: &Member, to: &Member) {
        self.try_unrelate(from, to).unwrap_or_else(|| {
            log::error!("Graph::unrelated: something must be wrong with the method :(")
        })
    }

    /// A helper method for [`Graph::unrelate`].
    fn try_unrelate(&self, from: &Member, to: &Member) -> Option<()> {
        let to_index = from.get_target_index_in_relations(to)?;
        let from_index = to.get_target_index_in_relations(from)?;
        from.state_refmut().relations.remove(to_index);
        to.state_refmut().relations.remove(from_index);
        Some(())
    }

    /// Executes force-directed graph layout. If `animate` is `true`, the layout will be animated.
    pub fn force_direct_debounced(&self, animate: bool) {
        self.0.borrow().fdg_in_progress.set(true);

        let state = self.0.borrow();
        let me = self.clone();

        let cb = move || {
            if animate {
                me.animate_force_direct();
            } else {
                me.force_direct();
            }
        };

        *state.debounce_timeout.borrow_mut() = Some(CallbackTimer::new(300, Box::new(cb)));
    }

    #[allow(unused_labels)]
    pub fn force_direct(&self) {
        let state = self.0.borrow();
        let all_members = self.members();

        let mut working_items = all_members.iter().map(WorkingItem::new).collect::<Vec<_>>();
        // TODO
        // let mut attract_repel_enabled = false;

        // // Iterate up to MAX_ITERS times.
        // 'outer: for _ in 0..MAX_ITERS {
        //     force_direct_step(&mut working_items, &all_members, &FdgPhase::Attract);
        // }
        'outer: for _ in 0..MAX_ITERS {
            // // Reset the max step size and clear samples when we switch phases
            // if !attract_repel_enabled {
            //     attract_repel_enabled = true;
            //     working_items.iter_mut().for_each(|i| {
            //         i.max_step = Vector2D::ones() * MAX_STEP;
            //         i.samples.clear();
            //     });
            // }
            force_direct_step(&mut working_items, &all_members, &FdgPhase::AttractRepel);
        }

        for member in &state.members {
            member.commit_bbox(); // notify the app of the new bounding box
        }

        state.fdg_in_progress.set(false);
    }

    fn animate_force_direct(&self) {
        let mut state = self.0.borrow_mut();
        let all_members = &state.members;

        let mut working_items: Vec<WorkingItem<_>> = all_members
            .iter()
            .map(|member| WorkingItem::new(member.clone()))
            .collect();

        // TODO
        // let mut attract_repel_enabled = false;

        let me = self.clone();
        state.animator = Some(IntervalTimer::new(
            ANIMATE_STEP_MS,
            Box::new(move |i: usize| {
                // // TODO: Audit the phase and learning_rate versus the non-animated version.
                // let phase = if i < MAX_ITERS / 2 {
                //     FdgPhase::Attract
                // } else {
                //     // Reset the max step size and clear samples when we switch phases
                //     if !attract_repel_enabled {
                //         attract_repel_enabled = true;
                //         working_items.iter_mut().for_each(|i| {
                //             i.max_step = Vector2D::ones() * MAX_STEP;
                //             i.samples.clear();
                //         });
                //     }
                //     FdgPhase::AttractRepel
                // };

                // let phase = FdgPhase::Attract;
                let phase = FdgPhase::AttractRepel;

                let state = me.0.borrow();

                // Ideally we would damp more gradually when things are active,
                // and less gradually when they're not.
                force_direct_step(&mut working_items, &state.members, &phase);

                let mut acted = false;
                for item in &working_items {
                    item.member.set_position(item.position);
                    item.member.commit_bbox(); // notify the app of the new bounding box
                    if item.active() {
                        acted = true
                    }
                }

                if i == MAX_ITERS || !acted {
                    me.0.borrow().fdg_in_progress.set(false);
                    return false; // cancel the interval
                }

                acted
            }),
        ));
    }

    #[wasm_bindgen(getter, js_name = "fdg_in_progress")]
    pub fn js_fdg_in_progress(&self) -> JsObservable {
        self.0.borrow().fdg_in_progress.reader().into()
    }
}

impl Graph {
    /// Gets a reference to the members of the graph.
    pub fn members(&self) -> Ref<Vec<Member>> {
        Ref::map(self.0.borrow(), |g| &g.members)
    }
}

/// Performs a single step of force-directed graph layout.
fn force_direct_step<M>(
    working_items: &mut [WorkingItem<M>],
    all_members: &[Member],
    phase: &FdgPhase,
) where
    M: std::borrow::Borrow<Member>,
{
    // Presently doing force gradient descent at the same time as multi-member deconfliction.
    // There's a chance we need to isolate gradient descent as its own nested loop, but let's give this a try first.
    // The difference in cognitive complexity is small, and the difference in computational complexity is potentially large.
    for item in working_items.iter_mut() {
        let member: &Member = item.member.borrow();
        if !member.state.borrow().autoposition {
            continue;
        }

        let force = member.force_vector(item.position, all_members, phase);
        if force.magnitude() < f32::EPSILON {
            return;
        }

        let nforce = member.force_vector(item.position + NUDGE_VALUE, all_members, phase); // force at a nuged position

        let abs_delta = (force - nforce).abs();
        let rise = if force.signum() == nforce.signum() {
            // If the sign of the forces is the same, that's the direction of the slope.
            abs_delta * force.signum()
        } else {
            // Otherwise, the position and the nudged position straddle the point of attraction,
            // so we should use the sign of the stronger force.
            if force.magnitude() > nforce.magnitude() {
                abs_delta * force.signum()
            } else {
                abs_delta * nforce.signum()
            }
        };

        let run = Vector2D::ones() * NUDGE_VALUE;
        let slope = rise / run;

        item.apply_sample(Sample {
            position: item.position,
            slope,
            force,
        });
    }
}

struct WorkingItem<M>
where
    M: std::borrow::Borrow<Member>,
{
    member: M,
    position: PositionVector,
    max_step: Vector2D,
    samples: Vec<Sample>,
    count: usize,
}

impl<M> WorkingItem<M>
where
    M: std::borrow::Borrow<Member>,
{
    fn new(member: M) -> Self {
        Self {
            position: member.borrow().position(),
            member,
            max_step: Vector2D::ones() * MAX_STEP,
            samples: Vec::new(),
            count: 0,
        }
    }
    fn apply_sample(&mut self, sample: Sample) {
        // If this sample is better than what we have, add it. Otherwise, discard it.
        self.add_sample(sample.clone());
        self.count += 1;

        // Either way, we're determining our next position using only the best remaining samples.
        self.position = match self.samples.len() {
            1 => {
                let sample = self.samples.first().unwrap();
                // We don't need to adjust the step size when we have fewer than two samples.
                // Apply the step size to the sample slope and make a new position based on the sample position.

                // Slope could have a huge range of values, so using it directly to calculate the step size is pointless.
                // So the size of the first step could be tuned, but barring a "magic" reference value,
                // we essentialy cannot extract ANY meaningful information from the initial slope itself OTHER than its sign.
                // Example of a magic value: "Hey, we just randomly observed that things that are really close have a slope
                // of P and things that are really far have a slope of Q, so our initial step just smoothsteps between P-Q as 0-1".
                // This is an option, but it would have to be tuned based on observations of the initial behavior rather than any fixed calculation.
                let step = (sample.slope.signum() * INITIAL_STEP_SIZE).clamp(-MAX_STEP, MAX_STEP);
                sample.position + step
            }
            l if l > 1 => {
                let best = self.samples.first().unwrap();

                // Our potential next step
                let step = self.max_step * best.slope.signum();

                // Our potential next position
                let mut new_pos = best.position + step;

                // If the sign of the best sample's slope is different from the sign of the current sample's slope,
                // then we crossed the minimum force; meaning that two boxes are overlapping.
                // In that case, we should interpolate between the two positions.
                if best.slope.x.signum() != sample.slope.x.signum() {
                    new_pos.x = interpolate(best.position.x, sample.position.x);

                    // Opposing signs means we crossed the minimum force, so update the maximum step in that dimension.
                    let x_displacement = new_pos.x - best.position.x;
                    self.max_step.x = x_displacement.abs().max(MIN_STEP);
                } else {
                    self.max_step.x *= 0.9;
                }

                if best.slope.y.signum() != sample.slope.y.signum() {
                    new_pos.y = interpolate(best.position.y, sample.position.y);

                    // Opposing signs means we crossed the minimum force, so update the maximum step in that dimension.
                    let y_displacement = new_pos.y - best.position.y;
                    self.max_step.y = y_displacement.abs().max(MIN_STEP);
                } else {
                    self.max_step.y *= 0.9;
                }

                // TODO(MAYBE): We could also try to extrapolate based on non-opposing signs, but that's fancy stuff for later.

                new_pos
            }
            _ => panic!("sanity error - we just added a sample"),
        };

        self.member.borrow().set_position(self.position);
    }

    fn active(&self) -> bool {
        self.max_step.magnitude() > MIN_STEP
    }

    /// Checks if the current sample is our best sample, and if so, inserts it into the samples list.
    ///
    /// We only want to keep track of the last five samples right now, so if the samples list is full,
    /// then the worst sample will be removed.
    fn add_sample(&mut self, sample: Sample) {
        let smag = sample.slope.magnitude();
        let sf = sample.force.magnitude();

        // Instead of finding the index to insert at with a binary search, let's use `partition_point()`
        // to find the first index where the current slope and force are less than the sample's slope and force.
        // This way we can avoid inserting a sample at a wrong index when there are samples with the same slope.
        let index = self
            .samples
            .partition_point(|s| s.slope.magnitude() < smag && s.force.magnitude() < sf);

        if index < 5 {
            self.samples.insert(index, sample);
        }

        self.samples.truncate(5);
    }
}
#[derive(Debug, Clone)]
struct Sample {
    position: PositionVector,
    slope: Vector2D,
    force: Vector2D,
}

fn interpolate(a: f32, b: f32) -> f32 {
    (a + b) / 2.0
}
