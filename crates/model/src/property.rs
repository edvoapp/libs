use crate::{
    db::firestore_js::{JsTransaction, JsTrxRef},
    entity::JsEntity,
    search::SearchTokens,
    timer::CallbackTimer,
};
use hex;
use observable_react::JsObservable;
use sha2::{Sha256, Digest};
use std::error::Error;
use std::{cell::RefCell, rc::Rc};
use url::Url;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;

pub mod content;

use content::Content;

use self::content::content_type::ContentType;

#[wasm_bindgen(typescript_custom_section)]
const IJsProperty: &'static str = r#"
export interface IJsProperty extends IJsEntity {
    applyBeforeSaveHooks(trx: TrxRef)
    applyPostSaveHooks()
}
"#;

/** The Property/Entity object from JS */
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "IJsProperty", extends=JsEntity)]
    pub type JsProperty;

    #[wasm_bindgen(method)]
    pub fn applyBeforeSaveHooks(this: &JsProperty, trx: JsTrxRef);
}

#[wasm_bindgen(typescript_custom_section)]
const IJsUpdateContext: &'static str = r#"
export interface IJsUpdateContext {
    readonly data;
    setField(field: string, value: any)
    pushToArray(field: string, value: Uint8Array)
    //setArrayFieldFromU8Array(field: string, value: Uint8Array);
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "IJsUpdateContext")]
    pub type UpdateContext;

    #[wasm_bindgen(js_namespace = edvocommon, static_method_of = UpdateContext)]
    pub fn init() -> UpdateContext;

    #[wasm_bindgen(method, getter)]
    pub fn data(this: &UpdateContext) -> js_sys::Object;

    #[wasm_bindgen(method)]
    pub fn setField(this: &UpdateContext, field: &str, value: JsValue);

    #[wasm_bindgen(method)]
    pub fn pushToArray(this: &UpdateContext, field: &str, value: &[u8]);

    //#[wasm_bindgen(method)]
    //pub fn setArrayFieldFromU8Array(this: &UpdateContext, field: &str, value: &[u8]);

    #[wasm_bindgen(method)]
    pub fn applyBeforeSaveHooks(this: &JsEntity, trx: JsTransaction);

    #[wasm_bindgen(method)]
    pub fn applyPostSaveHooks(this: &JsEntity);
}

/**
 * FEATURES TODO:
 * Garbage collection for yrs/yjs needs to be turned OFF(?)
 * Undo
 * Relative position indication
 */
#[wasm_bindgen]
#[derive(Clone)]
pub struct Property {
    inner: Rc<PropertyInner>,
    #[allow(dead_code)]
    content_type: ContentType,
    #[wasm_bindgen(skip)]
    pub content: Rc<Content>,
}
struct PropertyInner {
    js_property: JsProperty,
    debounce_timeout: RefCell<Option<CallbackTimer>>,
}

impl Property {
    pub fn new(js_property: JsProperty, content_type: ContentType, module: Content) -> Property {
        Property {
            inner: Rc::new(PropertyInner {
                js_property,
                debounce_timeout: RefCell::default(),
            }),
            content_type,
            content: Rc::new(module),
        }
    }
}

#[wasm_bindgen]
impl Property {
    pub fn create(
        js_property: JsProperty,
        content_type: String,
        initial_string: Option<String>,
    ) -> Property {
        let content_type = ContentType::parse(&content_type);
        let module = initial_string.into();
        Self::new(js_property, content_type, module)
    }
    pub fn from_content(
        js_property: JsProperty,
        content_type: String,
        content: Content,
    ) -> Property {
        let content_type = ContentType::parse(&content_type);
        Self::new(js_property, content_type, content)
    }
    pub fn hydrate(
        js_property: JsProperty,
        content_type: String,
        // This is super weird, but we have to do it this way
        // to appease the Wasm-bindgen gods. OR copy the data redundantly, which we'd rather not do
        updates: &[u8],
        update_lengths: &[usize],
    ) -> Property {
        let content_type = ContentType::parse(&content_type);
        let module = (updates, update_lengths).into();
        Self::new(js_property, content_type, module)
    }

    pub fn hydrate_legacy(
        js_property: JsProperty,
        content_type: String,
        legacy_content_string: String,
    ) -> Property {
        let content_type = ContentType::parse(&content_type);
        let module = legacy_content_string.into();
        Self::new(js_property, content_type, module)
    }

    #[wasm_bindgen(js_name = "insert_string")]
    pub fn js_insert_string(&self, index: u32, string: String) {
        self.content.insert_chunk(index, string);
    }

    #[wasm_bindgen(getter, js_name = "content")]
    pub fn js_content(&self) -> JsObservable {
        self.content.obs().into()
    }

    #[wasm_bindgen(js_name = "pushContent")]
    pub fn push_content(&self, ucx: &UpdateContext) {
        if self.content_type == ContentType::TextPlain {
            let update_to_send = self.content.take_update_to_send();
            ucx.pushToArray("updateArray", update_to_send.as_slice());
            let keywords = self.content.obs().value().search_tokens_js();
            ucx.setField("keywords", keywords.into());
            let match_key = generate_sha256_hash(&self.content.obs().value().to_lossy_string()).into();
            ucx.setField("matchKey", match_key);
        } else if self.content_type == ContentType::TextXUri {
            let payload: JsValue = self.content.obs().value().to_lossy_string().into();
            ucx.setField("payload", payload);
            ucx.setField("keywords", js_sys::Array::new().into());
            let url = self.content.obs().value().to_lossy_string();
            let normalized_url = normalize_url(&url);
            match normalized_url {
                Ok(url) => {
                    let match_key = generate_sha256_hash(&url).into();
                    ucx.setField("matchKey", match_key);
                }
                Err(_) => {}
            }
        } else {
            let payload: JsValue = self.content.obs().value().to_lossy_string().into();
            ucx.setField("payload", payload);
            ucx.setField("keywords", js_sys::Array::new().into());
        }
    }

    /// Save now
    pub fn save(&self, trx: &JsTrxRef) {
        // Clear timer and also don't leak memory (debounce_timeout: Some() contains Rc to self.content)
        self.inner.debounce_timeout.borrow_mut().take();
        let ucx = UpdateContext::init();
        self.push_content(&ucx);

        let _ = trx.update(self.inner.js_property.clone().into(), ucx.data());
        self.inner.js_property.applyBeforeSaveHooks(trx.clone());
        if let Ok(txh) = trx.upgrade_checked() {
            let inner = self.inner.clone();
            txh.add_post_commit_hook(Box::new(move || {
                inner.js_property.applyPostSaveHooks();
                None
            }))
        }
    }

    pub fn debounce_save(&self) {
        // create closure for timeout
        let inner = Rc::downgrade(&self.inner);
        let content_type = self.content_type.clone();
        let content = Rc::downgrade(&self.content);

        let cb = move || {
            let mut owned_trx = JsTransaction::create("tx-property-debounced");
            let this = Property {
                inner: inner.upgrade()?,
                content_type,
                content: content.upgrade()?,
            };
            if let Some(trx) = owned_trx.get_ref() {
                this.save(&trx)
            }
            let _ = future_to_promise(async move {
                match owned_trx.apply().await {
                    Ok(_) => Ok(JsValue::undefined()),
                    Err(e) => Err(e.into()),
                }
            });
            Some(())
        };

        let cb = move || {
            cb();
        };

        // set timeout - will automatically drop a pre-existing timer at this location
        *self.inner.debounce_timeout.borrow_mut() = Some(CallbackTimer::new(900, Box::new(cb)));
    }

    // pub fn clear_content(&self) {
    //     let len = self.content.obs().get().len();
    //     self.
    // }

    // TODO: Delete this method when TS support ChunkRef[]
    // HACK: allow to hanlde the conentn if onlyis composed by DataChunk::Text
    #[wasm_bindgen(js_name = "content_as_string")]
    pub fn js_content_as_string(&self) -> String {
        self.content.obs().value().to_lossy_string()
    }

    #[wasm_bindgen(js_name = "apply_updates_from_db")]
    pub fn js_apply_updates_from_db(&self, updates: &[u8], update_lengths: &[usize]) {
        self.content.apply_updates_from_db(updates, update_lengths);
    }

    #[wasm_bindgen(js_name = "remove_range")]
    pub fn js_remove_range(&self, index: u32, length: u32) {
        self.content.remove_range(index, length);
    }

    pub fn replace_content(&self, content: String) {
        self.content.replace_content(content);
    }
}

/// Convert a string into a SHA256 hash
///
/// # Arguments
///
/// * `input` - A string slice that holds the value to be hashed
pub fn generate_sha256_hash(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());

    // Read hash digest and consume hasher
    let result = hasher.finalize();

    // Convert hash digest to hex string
    hex::encode(result)
}

/// Normalize a given URL by trimming leading and trailing whitespaces,
/// and lowercasing the protocol and host from the URL string.
///
/// # Arguments
///
/// * `url` - A string slice that holds the URL to be normalized
pub fn normalize_url(url: &str) -> Result<String, Box<dyn Error>> {
    let u1 = url.trim();
    let mut u = Url::parse(u1)?;
    let parsed_url = Url::parse(&u1.to_lowercase())?;
    let _ = u.set_host(parsed_url.host_str());
    let _ = u.set_scheme(parsed_url.scheme());
    Ok(u.into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_url_deals_with_origin() {
        let url1 = "http://localhost:4100/firestore/default/data/vertex/E28GkqOQ1hOrRkcsoQVA/property/5yV8xesB2bxL4VurjuM9";
        let url2 = "HTTP://localhost:4100/firestore/default/data/vertex/E28GkqOQ1hOrRkcsoQVA/property/5yV8xesB2bxL4VurjuM9";
        let normalized_url1 = normalize_url(url1).unwrap();
        let normalized_url2 = normalize_url(url2).unwrap();
        assert_eq!(normalized_url1, normalized_url2);
    }

    #[test]
    fn test_normalize_url_does_not_affect_pathname() {
        let url1 = "http://localhost:4100/firestore/default/data/vertex/E28GkqOQ1hOrRkcsoQVA/property/5yV8xesB2bxL4VurjuM9";
        let url2 = "HTTP://localhost:4100/firestore/default/data/vertex/e28gkqOQ1hOrrkcsoqva/property/5yV8xesB2bxL4VurjuM9";
        let normalized_url1 = normalize_url(url1).unwrap();
        let normalized_url2 = normalize_url(url2).unwrap();
        assert_ne!(normalized_url1, normalized_url2);
    }

    #[test]
    fn test_generate_sha256_hash() {
        let input = "test";
        let expected_digest = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"; // generated from JS side
        let actual_digest = generate_sha256_hash(input);
        assert_eq!(
            &actual_digest, expected_digest,
            "Hashes don't match for the input {}",
            input
        );
    }

    #[test]
    fn test_generate_sha256_hash_empty_string() {
        let input = "";
        let expected_digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        let actual_digest = generate_sha256_hash(input);
        assert_eq!(
            &actual_digest, expected_digest,
            "Hashes don't match for the input {}",
            input
        );
    }
}
