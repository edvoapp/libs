pub mod dom_node_wrapper;
pub mod test_support;
pub mod vm_node_wrapper;

use crate::WalkableNode;
use std::fmt::Debug;
use wasm_bindgen::prelude::*;

#[derive(Clone, PartialEq, Debug)]
pub struct NodeOffset<T: WalkableNode + Clone> {
    pub node: T,
    pub offset: usize,
}

#[wasm_bindgen]
#[derive(PartialEq, Eq, Debug)]
pub enum Direction {
    Forward,
    Reverse,
}

#[wasm_bindgen]
pub enum NodeType {
    Text,
    Lozenge,
}

// right now the closure returns Option<usize>
// We could change (for clarity) to return
pub enum WalkAction {
    Stop(usize), // Some
    Continue,    // None
}

/// Walk over a series of sibling nodes from a given origin to a stopping point, determined by a given evaluator closure.
/// This closure returns a WalkAction which causes the walk to continue or stop at a given stopping point
///
/// ```
/// use edvo_viewmodel::{NodeOffset, WalkAction, walk_nodes, Direction, WalkableNode};
/// use edvo_viewmodel::test_support::TestNode;
///
/// let parent = TestNode::parent();
/// let a = TestNode::text(10);
/// let b = TestNode::text(10);
/// parent.append_child(a.clone());
/// parent.append_child(b.clone());
///
/// let mut want = 15;
/// let mut count = 0;
/// let NodeOffset{ node, offset } = walk_nodes(
///     NodeOffset { node: a, offset: 0 },
///     Direction::Forward,
///     |node, offset| { // node = a; offset = 0
///         let take = want.min(node.length() - offset); // the most I can take for this node is 10
///        
///         count += take;  // later I might care how many steps I took total (and maybe even what kind of nodes/steps)
///         want -= take;
///         if want == 0 {
///            WalkAction::Stop(take)
///         }else{
///            WalkAction::Continue
///         }
///     }
/// );
/// assert_eq!(want, 0);
/// assert_eq!(node, b);
/// assert_eq!(offset, 5);
/// assert_eq!(count, 15);
/// ```
///
pub fn walk_nodes<N: WalkableNode + Clone>(
    origin: NodeOffset<N>,
    direction: Direction,
    mut evaluator: impl FnMut(&N, usize) -> WalkAction,
) -> NodeOffset<N> {
    let mut last_node: Option<N> = None;
    let mut next = Some(origin);

    while let Some(NodeOffset { node, offset }) = next.take() {
        if let WalkAction::Stop(o) = evaluator(&node, offset) {
            return NodeOffset { node, offset: o };
        }
        next = next_node(&node, &direction);
        last_node = Some(node);
    }

    let last_node = last_node.unwrap();
    let last_node_len = last_node.length();

    NodeOffset {
        node: last_node,
        offset: match direction {
            Direction::Forward => last_node_len,
            Direction::Reverse => 0,
        },
    }
}

fn next_node<N: WalkableNode>(node: &N, direction: &Direction) -> Option<NodeOffset<N>> {
    // Ok, we're continuing on to the next/prev node
    match direction {
        Direction::Forward => node.next_sibling(),
        Direction::Reverse => node.previous_sibling(),
    }
    .map(|sib| match direction {
        Direction::Forward => NodeOffset {
            node: sib,
            offset: 0,
        },
        Direction::Reverse => NodeOffset {
            offset: sib.length(),
            node: sib,
        },
    })
}

/// Finds the global offset based on the node and its local offset
///
/// ```txt
/// The [dog] eats| meat
///               ^
///               local offset: 5
///               global offset: 10
/// ```
///
/// ## Example
///
/// ```
/// use edvo_viewmodel::test_support::TestNode;
/// use edvo_viewmodel::get_node_global_offset;
///
/// let textfield = TestNode::parent();
///
/// let text1 = TestNode::text(4);
/// let lozenge = TestNode::lozenge();
/// let text2 = TestNode::text(10);
///
/// textfield.append_child(text1.clone());
/// textfield.append_child(lozenge.clone());
/// textfield.append_child(text2.clone());
///
/// let node_offset = get_node_global_offset(text2.clone(), 5);
/// assert_eq!(node_offset.node, text2);
/// assert_eq!(node_offset.offset, 10);
///
/// let node_offset = get_node_global_offset(text1.clone(), 6);
/// assert_eq!(node_offset.node, text2.clone());
/// assert_eq!(node_offset.offset, 6);
///
/// let node_offset = get_node_global_offset(lozenge.clone(), 2);
/// assert_eq!(node_offset.node, text2.clone());
/// assert_eq!(node_offset.offset, 6);
/// ```
pub fn get_node_global_offset<N>(node: N, local_offset: usize) -> NodeOffset<N>
where
    N: WalkableNode,
{
    let mut global_offset = 0;

    let node_offset = NodeOffset {
        node: node.clone(),
        offset: 0,
    };
    walk_nodes(node_offset, Direction::Reverse, |_, offset| {
        global_offset += offset;
        WalkAction::Continue
    });

    let raw_node_offset = NodeOffset {
        node,
        offset: local_offset,
    };
    let mut wanted = local_offset;
    let node_offset = walk_nodes(raw_node_offset, Direction::Forward, |n, __| {
        let len = n.length();
        if wanted > len {
            wanted -= len;
            global_offset += len;
            WalkAction::Continue
        } else {
            global_offset += wanted;
            WalkAction::Stop(wanted)
        }
    });

    NodeOffset {
        node: node_offset.node,
        offset: global_offset,
    }
}

/// Finds the global offset based on the node and its local offset
///
/// ```txt
/// The [dog] eats| meat
///               ^
///               local offset: 5
///               global offset: 10
/// ```
///
/// ## Example
///
/// ```
/// use edvo_viewmodel::test_support::TestNode;
/// use edvo_viewmodel::get_node_local_offset;
///
/// let textfield = TestNode::parent();
///
/// let text1 = TestNode::text(4);
/// let lozenge = TestNode::lozenge();
/// let text2 = TestNode::text(10);
///
/// textfield.append_child(text1.clone());
/// textfield.append_child(lozenge);
/// textfield.append_child(text2.clone());
///
/// let node_offset = get_node_local_offset(text1, 10);
/// assert_eq!(node_offset.node, text2);
/// assert_eq!(node_offset.offset, 5);
/// ```
pub fn get_node_local_offset<N>(first_node: N, mut want_offset: usize) -> NodeOffset<N>
where
    N: WalkableNode,
{
    let first_node = NodeOffset {
        node: first_node,
        offset: 0,
    };

    walk_nodes::<N>(first_node, Direction::Forward, |node, _| {
        let len = node.length();
        if len < want_offset {
            want_offset -= len;
            WalkAction::Continue
        } else {
            WalkAction::Stop(want_offset)
        }
    })
}

// TESTS
#[cfg(test)]
mod tests {
    use crate::{
        get_node_global_offset, get_node_local_offset, test_support, walk_nodes, Direction,
        NodeOffset, WalkableNode,
    };

    use super::WalkAction;

    use super::test_support::TestNode;

    // [10][L][L]
    // \ begins in 0.0
    //    moves 12 to right
    //           \ must finish in 10.2
    #[test]
    fn walk_nodes_test() {
        let parent = TestNode::parent();

        let first_text = TestNode::text(10);
        let first_lozenge = TestNode::lozenge();
        let second_lozenge = TestNode::lozenge();

        parent.append_child(first_text.clone());
        parent.append_child(first_lozenge);
        parent.append_child(second_lozenge.clone());

        // WALK FORWARD A BUNCH
        let np = NodePosition::new(&first_text, 0);
        let np = np.move_right(12);

        assert_eq!(np.global_offset, 12);
        assert_eq!(np.offset.node, second_lozenge);
        assert_eq!(np.offset.offset, 1);
    }

    // [10][L][L][1,4]
    // \ begins in 0.0
    //    moves 13 to right
    //              \ must finish in 11.0
    #[test]
    fn walk_from_text_over_entities_to_text() {
        let parent = TestNode::parent();

        let first_text = TestNode::text(10);
        let first_entity = TestNode::lozenge();
        let second_entity = TestNode::lozenge();
        let second_text = TestNode::text(5);

        parent.append_child(first_text.clone());
        parent.append_child(first_entity);
        parent.append_child(second_entity);
        parent.append_child(second_text.clone());

        let np = NodePosition::new(&first_text, 0);
        let np = np.move_right(13);

        assert_eq!(np.global_offset, 13);
        assert_eq!(np.offset.offset, 1);
        assert_eq!(np.offset.node, second_text);
    }

    // [10][L][L][L][5][L]
    //              \ begins in 10.3 (equivalent to 11.0)
    // moves to to the right
    //        \ must finish in 10.1
    #[test]
    fn walk_back_2() {
        let parent = TestNode::parent();

        let first_text = TestNode::text(10);
        let second_text = TestNode::text(5);
        let first_entity = TestNode::lozenge();
        let third_entity = TestNode::lozenge();
        parent.append_child(first_text);
        parent.append_child(first_entity.clone());
        parent.append_child(TestNode::lozenge());
        parent.append_child(third_entity.clone());
        parent.append_child(second_text.clone());
        parent.append_child(TestNode::lozenge());

        let mut np = NodePosition::new(&second_text, 13);
        assert_eq!(np, (third_entity, 13, 1));

        np = np.move_left(2);
        assert_eq!(np, (first_entity, 11, 1));
    }

    #[test]
    fn walk_forward_in_single_text() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(20);
        parent.append_child(first_text.clone());

        // start at 5
        let node_offset = NodeOffset {
            node: first_text,
            offset: 5,
        };

        let mut want_either = 5;
        let mut text_offset = 5;

        let offset = walk_nodes(
            node_offset, //
            Direction::Forward,
            |node, offset| {
                let take = want_either.min(node.length() - offset);
                let prev_want_either = want_either;
                want_either -= take;

                match node.kind() {
                    test_support::NodeType::Text { .. } => {
                        text_offset += take;
                    }
                    test_support::NodeType::Lozenge => {
                        unreachable!()
                    }
                };

                if prev_want_either <= node.length() - offset {
                    WalkAction::Stop(offset + take)
                } else {
                    WalkAction::Continue
                }
            },
        );

        assert_eq!(offset.offset, 10);

        assert_eq!(want_either, 0);
        assert_eq!(text_offset, 10);
    }

    // [15,5]
    //    \ begins in 15.0
    //          walks forward
    //       \ must end in 20.0
    #[test]
    fn exceed_max_walk_forward() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(20);
        parent.append_child(first_text.clone());

        let mut want_either = 20;
        let mut text_offset = 15;

        // count to where we are + 20, which far exceeds our possible length
        let offset = walk_nodes(
            NodeOffset {
                node: first_text.clone(),
                offset: 15,
            },
            Direction::Forward,
            |node, offset| {
                let take = want_either.min(node.length() - offset);
                let prev_want_either = want_either;
                want_either -= take;

                match node.kind() {
                    test_support::NodeType::Text { .. } => {
                        text_offset += take;
                    }
                    test_support::NodeType::Lozenge => {
                        unreachable!()
                    }
                };

                if prev_want_either <= node.length() - offset {
                    WalkAction::Stop(offset + take)
                } else {
                    WalkAction::Continue
                }
            },
        );

        assert_eq!(offset.node, first_text);

        // it should just go to the end of the line
        assert_eq!(offset.offset, 20);

        assert_eq!(want_either, 15);
        assert_eq!(text_offset, 20);
    }

    // [15,0]
    //    \ begins in 15.0
    //     try to move 20 to the left
    // \ must finish in 0.0
    #[test]
    fn exceed_max_walk_reverse() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(20);
        parent.append_child(first_text.clone());

        let mut np = NodePosition::new(&first_text, 15);
        assert_eq!(np, (first_text.clone(), 15, 15));

        np = np.move_left(20);
        assert_eq!(np, (first_text, 0, 0));
    }

    // [15,5]
    //     \ begins in 15.0
    //  move to left without limit
    //  \ must finish in 0.0
    #[test]
    fn no_limit_reverse() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(20);
        parent.append_child(first_text.clone());

        let mut np = NodePosition::new(&first_text, 15);
        assert_eq!(np, (first_text.clone(), 15, 15));

        np = np.move_left_with_no_limit();

        assert_eq!(np, (first_text, 0, 0));
    }

    // [10][L][10]
    //        \ begins in 10.1
    // move left with no limit (over text and lozenge)
    // \ must finish in 0.0
    #[test]
    fn reverse_over_lozenge() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(10);
        let entity = TestNode::lozenge();
        let second_text = TestNode::text(10);
        parent.append_child(first_text.clone());
        parent.append_child(entity);
        parent.append_child(second_text.clone());

        let mut np = NodePosition::new(&second_text, 13);
        assert_eq!(np, (second_text, 13, 2));

        np = np.move_left_with_no_limit();
        assert_eq!(np, (first_text, 0, 0));
    }

    // [20][L][10]
    //        \ begins in 20.1
    // move one to left
    //     \ must finish in 20.0
    #[test]
    fn reverse_into_lozenge() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(20);
        let lozenge = TestNode::lozenge();
        let second_text = TestNode::text(10);
        parent.append_child(first_text.clone());
        parent.append_child(lozenge.clone());
        parent.append_child(second_text.clone());

        let mut np = NodePosition::new(&second_text, 21);
        assert_eq!(np, (lozenge, 21, 1));

        np = np.move_left(1);
        assert_eq!(np, (first_text, 20, 20));
    }

    // [L][L][L][L][L]
    //             \ begins in 0.4
    // moves to left with no limit
    // \ must finish in 0.0
    #[test]
    fn walk_reverse_entities() {
        let parent = TestNode::parent();
        let first_ent = TestNode::lozenge();
        let second_ent = TestNode::lozenge();
        let third_ent = TestNode::lozenge();
        let fourth_ent = TestNode::lozenge();
        let fifth_ent = TestNode::lozenge();
        parent.append_child(first_ent.clone());
        parent.append_child(second_ent);
        parent.append_child(third_ent);
        parent.append_child(fourth_ent.clone());
        parent.append_child(fifth_ent.clone());

        let mut np = NodePosition::new(&fifth_ent, 4);
        assert_eq!(np, (fourth_ent, 4, 1));

        np = np.move_left_with_no_limit();
        assert_eq!(np, (first_ent, 0, 0));
    }

    // [L][L][L][L][L]
    // \ begins in 0.0
    //   move to the end
    //                \ must finish in 0.5
    #[test]
    fn walk_forward_entities() {
        let parent = TestNode::parent();
        let first_ent = TestNode::lozenge();
        let fifth_ent = TestNode::lozenge();
        parent.append_child(first_ent.clone());
        parent.append_child(TestNode::lozenge());
        parent.append_child(TestNode::lozenge());
        parent.append_child(TestNode::lozenge());
        parent.append_child(fifth_ent.clone());

        let node_offset = NodeOffset {
            node: first_ent,
            offset: 0,
        };

        let mut substep_offset = 0;

        let offset = walk_nodes(
            node_offset, //
            Direction::Forward,
            |node, offset| {
                let take = node.length() - offset;

                match node.kind() {
                    test_support::NodeType::Text { .. } => {
                        unreachable!()
                    }
                    test_support::NodeType::Lozenge => {
                        substep_offset += take;
                    }
                };

                WalkAction::Continue
            },
        );

        assert_eq!(offset.node, fifth_ent);
        assert_eq!(offset.offset, 1);
    }

    // [6][L][2,4]
    // \ begins in 0.0
    //   moves 9 positions to the right one by one.
    //         \ must finish in 8.0
    #[test]
    fn walk_into_lozenge() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(6);
        let first_ent = TestNode::lozenge();
        let second_text = TestNode::text(6);

        parent.append_child(first_text.clone());
        parent.append_child(first_ent.clone());
        parent.append_child(second_text.clone());

        let mut np = NodePosition::new(&first_text, 0);
        assert_eq!(np, (first_text.clone(), 0, 0));

        np = np.move_right(1);
        assert_eq!(np, (first_text.clone(), 1, 1));

        np = np.move_right(1);
        assert_eq!(np, (first_text.clone(), 2, 2));

        np = np.move_right(1);
        assert_eq!(np, (first_text.clone(), 3, 3));

        np = np.move_right(1);
        assert_eq!(np, (first_text.clone(), 4, 4));

        np = np.move_right(1);
        assert_eq!(np, (first_text.clone(), 5, 5));

        np = np.move_right(1);
        assert_eq!(np, (first_text, 6, 6));

        np = np.move_right(1);
        assert_eq!(np, (first_ent, 7, 1));

        np = np.move_right(1);
        assert_eq!(np, (second_text.clone(), 8, 1));

        np = np.move_right(1);
        assert_eq!(np, (second_text, 9, 2));
    }

    // [6][L][L][L][L][1,2]
    //                  \ begins in 7.0
    // move 1 left
    //                \ must finish in 6.4
    #[test]
    fn walk_backward_into_lozenge() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(6);
        let fourth_ent = TestNode::lozenge();
        let second_text = TestNode::text(3);

        parent.append_child(first_text.clone());
        parent.append_child(TestNode::lozenge());
        parent.append_child(TestNode::lozenge());
        parent.append_child(TestNode::lozenge());
        parent.append_child(fourth_ent.clone());
        parent.append_child(second_text.clone());

        let mut np = NodePosition::new(&first_text, 0);
        assert_eq!(np, (first_text, 0, 0));

        np = np.move_right(11);
        assert_eq!(np, (second_text, 11, 1));

        np = np.move_left(1);
        assert_eq!(np, (fourth_ent, 10, 1));
    }

    // [3,1,2]
    //     \ begins in 4.0
    //  moves 1 to left
    //   \ must finish in 3.0
    #[test]
    fn walk_backward() {
        let parent = TestNode::parent();
        let first_text = TestNode::text(6);

        parent.append_child(first_text.clone());

        let np = NodePosition::new(&first_text, 4);
        assert_eq!(np, (first_text.clone(), 4, 4));

        let np = np.move_left(1);
        assert_eq!(np, (first_text, 3, 3));
    }

    #[derive(PartialEq, Debug, Clone)]
    struct NodePosition {
        global_offset: usize,
        offset: NodeOffset<TestNode>,
    }

    impl PartialEq<(TestNode, usize, usize)> for NodePosition {
        fn eq(&self, other: &(TestNode, usize, usize)) -> bool {
            self.offset.node == other.0
                && self.global_offset == other.1
                && self.offset.offset == other.2
        }
    }

    impl NodePosition {
        // Provides the position from the begining of a `text_field`
        fn new(text_field: &TestNode, global_offset: usize) -> Self {
            let first_node = match text_field.get_parent() {
                Some(parent) => parent.first_child().unwrap(),
                None => text_field.clone(),
            };
            let node_offset = get_node_local_offset(first_node, global_offset);

            let node_global = get_node_global_offset(node_offset.node.clone(), node_offset.offset);

            NodePosition {
                global_offset: node_global.offset,
                offset: node_offset,
            }
        }

        fn move_left_with_no_limit(self) -> Self {
            let first = self.offset.node.first_sibling();
            NodePosition {
                offset: NodeOffset {
                    node: first,
                    offset: 0,
                },
                global_offset: 0,
            }
        }

        fn move_right(self, mut wanted: usize) -> NodePosition {
            if wanted == 0 {
                return self;
            }

            let mut global = self.global_offset;
            let offset = walk_nodes(
                self.offset, //
                Direction::Forward,
                |node, offset| {
                    let available = node.length() - offset;
                    let take = wanted.min(available);
                    let prev_want_either = wanted;
                    wanted -= take;
                    global += take;
                    if prev_want_either <= available {
                        WalkAction::Stop(offset + take)
                    } else {
                        WalkAction::Continue
                    }
                },
            );
            NodePosition {
                global_offset: global,
                offset,
            }
        }

        fn move_left(self, mut want_either: usize) -> NodePosition {
            if want_either == 0 {
                return self;
            }

            let mut global = self.global_offset;

            if want_either >= global {
                let first = self.offset.node.first_sibling();
                return NodePosition {
                    global_offset: 0,
                    offset: NodeOffset {
                        node: first,
                        offset: 0,
                    },
                };
            }

            let offset = walk_nodes(
                self.offset, //
                Direction::Reverse,
                |_, offset| {
                    let available = offset;
                    let take = want_either.min(available);
                    let prev_want_either = want_either;
                    want_either -= take;
                    global -= take;

                    if prev_want_either < available && offset - take > 0 {
                        WalkAction::Stop(offset - take)
                    } else {
                        WalkAction::Continue
                    }
                },
            );

            NodePosition {
                global_offset: global,
                offset,
            }
        }
    }
}
