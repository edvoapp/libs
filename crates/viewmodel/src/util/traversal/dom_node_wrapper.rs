use crate::get_node_global_offset;
use crate::walk_nodes;
use crate::Direction;
use crate::NodeOffset;
use crate::WalkAction;

use super::WalkableNode;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{Element, Node, Text};

#[derive(Clone, Debug, PartialEq)]
#[wasm_bindgen]
pub struct DomNodeWrapper {
    // in the case of a text node, this is the parent span wrapper
    node: Node,
}

#[wasm_bindgen]
impl DomNodeWrapper {
    pub fn new(node: Node) -> Self {
        DomNodeWrapper { node }
    }

    pub fn get_dom_element(&self) -> Node {
        self.node.clone()
    }
}

impl WalkableNode for DomNodeWrapper {
    fn previous_sibling(&self) -> Option<DomNodeWrapper> {
        self.node.previous_sibling().map(DomNodeWrapper::new)
    }

    fn next_sibling(&self) -> Option<DomNodeWrapper> {
        self.node.next_sibling().map(DomNodeWrapper::new)
    }

    fn length(&self) -> usize {
        if let Some(el) = self.node.dyn_ref::<Element>() {
            if el.class_list().contains("lozenge-inline-block") {
                return 1;
            } else if let Some(first) = self.node.first_child() {
                if first.dyn_ref::<Text>().is_some() {
                    return if let Some(txt) = first.dyn_ref::<Text>() {
                        txt.length() as usize
                    } else {
                        0
                    };
                }
            }
        }
        0
    }
}

#[wasm_bindgen]
pub struct WalkDomNodesResponse {
    node_offset: NodeOffset<DomNodeWrapper>,
}
#[wasm_bindgen]
impl WalkDomNodesResponse {
    #[wasm_bindgen(getter)]
    pub fn node_offset(&self) -> DomNodeOffset {
        DomNodeOffset(self.node_offset.clone())
    }
}

#[derive(Clone)]
#[wasm_bindgen]
pub struct DomNodeOffset(NodeOffset<DomNodeWrapper>);

#[wasm_bindgen]
impl DomNodeOffset {
    #[wasm_bindgen(getter)]
    pub fn node(&self) -> DomNodeWrapper {
        self.0.node.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn offset(&self) -> usize {
        self.0.offset
    }
}

#[wasm_bindgen]
pub fn walk_dom_nodes(
    node: Node,
    offset: usize,
    direction: Direction,
    f: Option<js_sys::Function>,
) -> WalkDomNodesResponse {
    let origin = NodeOffset {
        node: DomNodeWrapper::new(node),
        offset,
    };

    let node_offset = if let Some(func) = f {
        walk_nodes(origin, direction, |node: &DomNodeWrapper, offset: usize| {
            let ret = func
                .call2(&JsValue::UNDEFINED, &node.get_dom_element(), &offset.into())
                .unwrap();

            if ret.is_null() || ret.is_undefined() {
                WalkAction::Continue
            } else {
                let jsoffset = ret.as_f64().unwrap();
                WalkAction::Stop(jsoffset as usize)
            }
        })
    } else {
        walk_nodes(origin, direction, |_, _| WalkAction::Continue)
    };

    WalkDomNodesResponse { node_offset }
}

#[wasm_bindgen]
pub fn get_dom_node_global_offset(node: Node, local_offset: usize) -> DomNodeOffset {
    let node = DomNodeWrapper::new(node);
    let node_offset = get_node_global_offset(node, local_offset);
    DomNodeOffset(node_offset)
}
