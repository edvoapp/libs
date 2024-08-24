use std::fmt::Debug;

use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

#[wasm_bindgen(typescript_custom_section)]
const IJsEntity: &'static str = r#"
export interface IJsEntity {
    readonly id: string,
    path(): string,
    isEditable(): boolean
    setSaved(): void,
    readonly saved: Promise<void>
    readonly docRef: IJsDocumentRef
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "IJsEntity")]
    pub type JsEntity;

    #[wasm_bindgen(method, getter)]
    pub fn id(this: &JsEntity) -> String;

    #[wasm_bindgen(method)]
    pub fn path(this: &JsEntity) -> String;

    #[wasm_bindgen(method, js_name = "isEditable")]
    pub fn is_editable(this: &JsEntity) -> bool;

    #[wasm_bindgen(method, js_name = "setSaved")]
    pub fn set_saved(this: &JsEntity);

    #[wasm_bindgen(method, getter, js_name = "saved")]
    async fn js_saved(this: &JsEntity) -> JsValue; // Promise<void>

    #[wasm_bindgen(method, getter, js_name = "docRef")]
    pub fn doc_ref(this: &JsEntity) -> DocumentRef;
}
impl JsEntity {
    pub async fn saved(&self) {
        self.js_saved().await;
    }
}
impl Debug for JsEntity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Entity").field("obj", &self.obj).finish()
    }
}

// This is another mod to avoid name collisions
mod doc_ref {
    use wasm_bindgen::prelude::wasm_bindgen;

    #[wasm_bindgen(typescript_custom_section)]
    const IJsDocumentRef: &'static str = r#"
interface IJsDocumentRef {
    readonly id: string,
    readonly path: string
}
"#;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(typescript_type = "IJsDocumentRef")]
        pub type DocumentRef;

        #[wasm_bindgen(method, getter)]
        pub fn id(this: &DocumentRef) -> String;

        #[wasm_bindgen(method, getter)]
        pub fn path(this: &DocumentRef) -> String;
    }

    impl std::fmt::Debug for DocumentRef {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            let path = self.path();
            f.debug_tuple("DocumentRef").field(&path).finish()
        }
    }
}
pub use doc_ref::DocumentRef;
