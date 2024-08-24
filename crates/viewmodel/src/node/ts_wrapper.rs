use std::rc::Rc;
use wasm_bindgen::prelude::wasm_bindgen;

#[derive(Clone)]
#[wasm_bindgen]
pub struct TSNodeWrapper(pub(crate) Rc<VMTextItemable>);

#[wasm_bindgen]
impl TSNodeWrapper {
    pub fn new(node: VMTextItemable) -> Self {
        TSNodeWrapper(Rc::new(node))
    }

    #[wasm_bindgen(getter)]
    pub fn ts_node(&self) -> VMTextItemable {
        (*self.0).clone().into()
    }

    pub fn previous_sibling(&self) -> Option<TSNodeWrapper> {
        self.0.prevSiblingAny().map(TSNodeWrapper::new)
    }

    pub fn next_sibling(&self) -> Option<TSNodeWrapper> {
        self.0.nextSiblingAny().map(TSNodeWrapper::new)
    }
}

#[wasm_bindgen(typescript_custom_section)]
const TSViewModelNode_STYLE: &'static str = r#"
export interface TSViewModelNode {
    get isVisible(): boolean
    get focusable(): boolean
    prevSiblingAny(): TSViewModelNode | undefined;
    nextSiblingAny(): TSViewModelNode | undefined;
    findClosest<T extends TSViewModelNode>(cb: (n: TSViewModelNode) => T | undefined | false): T | undefined
}

export interface TSTextItemable extends TSViewModelNode {
    chunk_length(): number;
    get contentDivisible(): boolean;
}

export interface TSChunk extends TSTextItemable {
    get contentForwardNode(): Node;
    get contentBackwardNode(): Node;
}
"#;

// Wasm bindgen Duck typing
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "TSViewModelNode")]
    pub type TsVMNode;

    #[wasm_bindgen(structural, method)]
    pub fn prevSiblingAny(this: &TsVMNode) -> Option<TsVMNode>;

    #[wasm_bindgen(structural, method)]
    pub fn nextSiblingAny(this: &TsVMNode) -> Option<TsVMNode>;
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "TSTextItemable", extends=TsVMNode)]
    pub type VMTextItemable;

    #[wasm_bindgen(structural, method)]
    pub fn prevSiblingAny(this: &VMTextItemable) -> Option<VMTextItemable>;

    #[wasm_bindgen(structural, method)]
    pub fn nextSiblingAny(this: &VMTextItemable) -> Option<VMTextItemable>;

    #[wasm_bindgen(structural, method)]
    pub fn chunk_length(this: &VMTextItemable) -> usize;
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "TSChunk", extends=VMTextItemable)]
    pub type VMChunk;

    // passing an owned value TO js constructs a proxy object with an id/pointer to a stack of "remotely" owned objects.
    // IE: wasm_bindgen has a Vec<Option<dyn Any>> somehwere where the owned object *really* lives
    // And then it constructs a JS object with the id in it.
    // When the JS code calls some method of the proxy object, the js binding code dispatches to the wasm code with the id + function name + arguments
    // The RUST binding code then looks up the object in that Vec, casts it to the correct type, and then dispatches to the function with the BORROWED object
    // This is for object.doSomething
    // BUT when the js proxy object is passed as an ARGUMENT to a function, the rust binding code looks up the object id and .takes the item from the Vec, so that it can be passed as owned inside the rust "runtime"

    // the return signature is "Owned" so the rust binding code (the rust code that wasm_bindgen generates) removes the item from the Vec
    // BUT the JS code is still holding the proxy object {"id":12345}  (which coordsponds to slot 12345 in the vec)
    // so when it passes {"id":12345} as a return value a second time, the vec[12345].take() fails, and it throws this error.

    // #[wasm_bindgen(structural, method)]
    // pub fn getChunkRef(this: &VMChunk) -> Option<ChunkRef>;

    #[wasm_bindgen(getter)]
    fn content_forward_node() -> web_sys::Node;
    #[wasm_bindgen(getter)]
    fn content_backward_node() -> web_sys::Node;
}
