use wasm_bindgen::prelude::*;

use crate::{
    get_node_global_offset, get_node_local_offset, walk_nodes, Direction, NodeOffset,
    TSNodeWrapper, VMTextItemable, WalkAction,
};

#[wasm_bindgen]
pub struct WalkVMNodesResponse(NodeOffset<TSNodeWrapper>);

#[wasm_bindgen]
impl WalkVMNodesResponse {
    #[wasm_bindgen(getter)]
    pub fn node(&self) -> TSNodeWrapper {
        self.0.node.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn offset(&self) -> usize {
        self.0.offset
    }
}

#[wasm_bindgen]
pub fn get_vm_node_global_offset(node: VMTextItemable, local_offset: usize) -> WalkVMNodesResponse {
    let first_node = TSNodeWrapper::new(node);
    let node_offset = get_node_global_offset(first_node, local_offset);
    WalkVMNodesResponse(node_offset)
}

#[wasm_bindgen]
pub fn get_vm_node_local_offset(
    first_node: VMTextItemable,
    want_offset: usize,
) -> WalkVMNodesResponse {
    let first_node = TSNodeWrapper::new(first_node);
    let node_offset = get_node_local_offset(first_node, want_offset);
    WalkVMNodesResponse(node_offset)
}

#[wasm_bindgen]
pub fn walk_vm_nodes(
    node: &TSNodeWrapper,
    offset: usize,
    direction: Direction,
    f: Option<js_sys::Function>,
) -> WalkVMNodesResponse {
    let origin = NodeOffset {
        node: node.clone(),
        offset,
    };

    let node_offset = if let Some(func) = f {
        walk_nodes(origin, direction, |node: &TSNodeWrapper, offset: usize| {
            let ret = func
                .call2(&JsValue::UNDEFINED, &node.ts_node(), &offset.into())
                .unwrap();

            if ret.is_null() || ret.is_undefined() {
                WalkAction::Continue
            } else {
                let jsoffset = ret.as_f64().unwrap() as usize;

                WalkAction::Stop(jsoffset)
            }
        })
    } else {
        walk_nodes(origin, direction, |_, _| WalkAction::Continue)
    };

    WalkVMNodesResponse(node_offset)
}
