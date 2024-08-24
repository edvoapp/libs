use std::{rc::Rc, sync::Arc};

use edvo_model::property::content::{Chunkable, DataChunk};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::ViewModelNode;

#[derive(Debug, PartialEq, Clone)]
#[wasm_bindgen]
pub struct TextFieldItem(Rc<Inner>);
impl ViewModelNode for TextFieldItem {}

#[derive(Debug, PartialEq)]
struct Inner {
    kind: TextFieldItemKind,
    // Other VMNode stuff in the future
}

#[derive(Debug, PartialEq)]
pub enum TextFieldItemKind {
    Text(Arc<str>),
    Edge(String),
    Unknown,
}

impl TextFieldItem {
    pub fn new(kind: TextFieldItemKind) -> Self {
        TextFieldItem(Rc::new(Inner { kind }))
    }

    pub fn from_datachunk(chunk: impl Into<DataChunk>) -> Self {
        let kind = match chunk.into() {
            DataChunk::Text(text) => TextFieldItemKind::Text(text),
            DataChunk::Edge(edge_id) => TextFieldItemKind::Edge(edge_id),
            DataChunk::Unknown => TextFieldItemKind::Unknown,
        };
        Self::new(kind)
    }

    pub fn text(text: impl Into<Arc<str>>) -> Self {
        Self::new(TextFieldItemKind::Text(text.into()))
    }

    pub fn edge(edge_id: impl Into<String>) -> Self {
        Self::new(TextFieldItemKind::Edge(edge_id.into()))
    }

    pub fn unknown() -> Self {
        Self::new(TextFieldItemKind::Unknown)
    }

    pub fn kind(&self) -> &TextFieldItemKind {
        &self.0.kind
    }
}

impl Default for TextFieldItem {
    fn default() -> Self {
        TextFieldItem(Rc::new(Inner {
            kind: TextFieldItemKind::Text("".into()),
        }))
    }
}

impl TextFieldItemKind {
    pub fn len(&self) -> usize {
        match self {
            TextFieldItemKind::Text(text) => text.len(),
            TextFieldItemKind::Edge(_) => 1,
            TextFieldItemKind::Unknown => 1,
        }
    }

    pub fn is_empty(&self) -> bool {
        match self {
            TextFieldItemKind::Text(text) => text.is_empty(),
            TextFieldItemKind::Edge(_) => false,
            TextFieldItemKind::Unknown => false,
        }
    }

    pub fn string(&self) -> Option<&str> {
        match self {
            TextFieldItemKind::Text(s) => Some(s),
            _ => None,
        }
    }

    pub fn edge_id(&self) -> Option<&str> {
        match self {
            TextFieldItemKind::Edge(id) => Some(id.as_str()),
            _ => None,
        }
    }
}

impl PartialEq<DataChunk> for TextFieldItemKind {
    fn eq(&self, other: &DataChunk) -> bool {
        match (self, other) {
            (TextFieldItemKind::Text(t1), DataChunk::Text(t2)) => t1 == t2,
            (TextFieldItemKind::Edge(e1), DataChunk::Edge(e2)) => e1 == e2,
            _ => false,
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct TextItemsAndLip {
    items: Vec<TextFieldItem>,
    lip: Option<usize>, // lozenge insertion positin
}

impl Default for TextItemsAndLip {
    fn default() -> Self {
        Self {
            items: vec![TextFieldItem::text("")],
            lip: None,
        }
    }
}

impl TextItemsAndLip {
    /// Convert chunks to TextFieldItems and split them if necessary
    /// to calculate the chunk index equivalent to a text offset
    ///
    /// ```text
    /// The [dog] eats
    /// ^0  ^4  ^5    ^10
    ///
    /// calculate_items_and_lip(None) => "The ", [dog], " eats"
    /// calculate_items_and_lip(0) => LIC, "The ", [dog], " eats"
    /// calculate_items_and_lip(2) => "Th", LIC, "e ", [dog], " eats"
    /// calculate_items_and_lip(4) => "The ", LIC, [dog], " eats"
    /// calculate_items_and_lip(5) => "The ", [dog], LIC, " eats"
    /// calculate_items_and_lip(8) => "The ", [dog], " ea", LIC, "ts"
    /// calculate_items_and_lip(10) => "The ", [dog], " eats", LIC
    /// calculate_items_and_lip(12) => "The ", [dog], " eats"
    /// ```
    pub fn calculate<C: Chunkable + ?Sized>(
        chunkale: &C,
        insertion_caret: Option<u32>,
    ) -> TextItemsAndLip {
        let mut wanted = insertion_caret.unwrap_or(u32::MAX) as usize;

        let mut items: Vec<TextFieldItem> = Vec::new();
        let mut lip = None;

        if wanted == 0 {
            lip = Some(0);
        }

        let mut chunks = chunkale.chunks().filter(|c| !c.is_empty());
        while let Some(chunk) = chunks.next() {
            let len = chunk.len();
            if wanted > len {
                items.push(TextFieldItem::from_datachunk(chunk.clone()));
                wanted -= len;
                continue;
            }

            if wanted == 0 {
                lip = Some(items.len());
                items.push(TextFieldItem::from_datachunk(chunk.clone()));
            } else {
                match chunk.split_at(wanted) {
                    Some((l, r)) => {
                        items.push(TextFieldItem::from_datachunk(l));
                        lip = Some(items.len());
                        items.push(TextFieldItem::from_datachunk(r));
                    }
                    None => {
                        items.push(TextFieldItem::from_datachunk(chunk.clone()));
                        lip = Some(items.len());
                    }
                }
            }
            // wanted = 0;
            break;
        }

        while let Some(chunk) = chunks.next() {
            items.push(TextFieldItem::from_datachunk(chunk.clone()));
        }

        if items.is_empty() {
            items.push(TextFieldItem::text(""))
        }

        TextItemsAndLip { items, lip }
    }

    pub fn items(&self) -> &'_ Vec<TextFieldItem> {
        &self.items
    }
    pub fn lip(&self) -> Option<usize> {
        self.lip
    }
}

pub mod js {
    use js_sys::Reflect;
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen(typescript_custom_section)]
    const IJsProperty: &'static str = r#"
export type TextFieldItem =
  | {kind: "text", value: string}
  | {kind: "eid", value: string}
  | {kind: "unknown", value?: null};

export type VoidCallback = () => void;
export type VoidCallbackOnce = () => void;
"#;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(typescript_type = "TextFieldItem")]
        pub type TextFieldItem;

        #[wasm_bindgen(typescript_type = "TextFieldItem[]")]
        pub type TextFieldItemArray;

        #[wasm_bindgen(typescript_type = "VoidCallback")]
        pub type VoidCallback;

        #[wasm_bindgen(typescript_type = "VoidCallbackOnce")]
        pub type VoidCallbackOnce;
    }

    impl TextFieldItem {
        fn new(kind: &str, value: Option<&JsValue>) -> TextFieldItem {
            let obj = js_sys::Object::new();
            let _ = Reflect::set(&obj, &"kind".into(), &kind.into());
            if let Some(value) = value {
                let _ = Reflect::set(&obj, &"value".into(), value);
            }
            TextFieldItem { obj: obj.into() }
        }

        pub fn text(s: &str) -> TextFieldItem {
            TextFieldItem::new("text", Some(&s.into()))
        }

        pub fn edge_id(eid: &str) -> TextFieldItem {
            TextFieldItem::new("eid", Some(&eid.into()))
        }

        pub fn unknown() -> TextFieldItem {
            TextFieldItem::new("unknown", None)
        }
    }

    impl From<&super::TextFieldItem> for TextFieldItem {
        fn from(value: &super::TextFieldItem) -> Self {
            match value.kind() {
                super::TextFieldItemKind::Text(s) => Self::text(s),
                super::TextFieldItemKind::Edge(eid) => Self::edge_id(eid),
                super::TextFieldItemKind::Unknown => Self::unknown(),
            }
        }
    }

    impl TryFrom<TextFieldItem> for super::TextFieldItem {
        type Error = JsValue;

        fn try_from(js_item: TextFieldItem) -> Result<Self, Self::Error> {
            let kind = Reflect::get(&js_item.obj, &"kind".into())?
                .as_string()
                .ok_or_else(|| JsError::new("TextFieldItem.kind is not a string"))?;
            let value = Reflect::get(&js_item.obj, &"value".into())?.as_string();
            let item = match kind.as_str() {
                "text" => super::TextFieldItem::text(value.unwrap_or_default()),
                "eid" => match value {
                    Some(eid) if !eid.is_empty() => super::TextFieldItem::edge(eid),
                    _ => Err(JsError::new(
                        "TextFieldItem.value bad formatted for eid kind",
                    ))?,
                },
                "unknown" => super::TextFieldItem::unknown(),
                _ => Err(JsError::new("TextFieldItem.kind not supported"))?,
            };
            Ok(item)
        }
    }

    impl TextFieldItemArray {
        pub fn from<I>(items: I) -> Self
        where
            I: AsRef<[super::TextFieldItem]>,
        {
            let items = items.as_ref();
            let array = js_sys::Array::new_with_length(items.len() as u32);
            for (index, item) in items.iter().enumerate() {
                let it = TextFieldItem::from(item);
                array.set(index as u32, it.obj);
            }
            TextFieldItemArray { obj: array.into() }
        }
    }

    impl VoidCallback {
        pub fn call(&self) -> Result<(), String> {
            let f: js_sys::Function = self.obj.clone().into();
            match f.call0(&JsValue::null()) {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("PrecommitFn error: {e:?}")),
            }
        }
    }

    impl VoidCallbackOnce {
        pub fn call(self) -> Result<(), String> {
            let f: js_sys::Function = self.obj.into();
            match f.call0(&JsValue::null()) {
                Ok(_) => Ok(()),
                Err(e) => Err(format!("PrecommitFn error: {e:?}")),
            }
        }
    }

    impl<F: FnOnce() + 'static> From<F> for VoidCallbackOnce {
        fn from(f: F) -> Self {
            VoidCallbackOnce {
                obj: Closure::once_into_js(f),
            }
        }
    }
}

#[cfg(test)]
mod calculate_items_and_lip_test {
    use edvo_model::property::content::{Chunkable, DataChunks};

    use super::TextItemsAndLip;
    use crate::item::TextFieldItem;

    fn check<C: Chunkable + ?Sized>(
        chunks: &C,
        offset: Option<u32>,
        expected_items: impl Into<Vec<TextFieldItem>>,
        expected_lip: Option<usize>,
    ) {
        assert_eq!(
            TextItemsAndLip::calculate(chunks, offset),
            TextItemsAndLip {
                items: expected_items.into(),
                lip: expected_lip,
            }
        );
    }

    #[test]
    fn no_lip_in_a_default_textfield_items() {
        check(
            &DataChunks::default(),
            None,
            [TextFieldItem::text("")],
            None,
        );
    }

    #[test]
    fn lip_in_a_default_textfield_items() {
        check(
            &DataChunks::default(),
            Some(0),
            [TextFieldItem::text("")],
            Some(0),
        );
    }

    #[test]
    fn no_lip_in_a_non_empty_textfield() {
        use edvo_model::property::content::{DataChunk, DataChunks};
        let chunks: DataChunks = vec![
            DataChunk::text("The "),
            DataChunk::edge("dog_id"),
            DataChunk::text(" eats"),
        ]
        .into();
        check(
            &chunks,
            None,
            [
                TextFieldItem::text("The "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" eats"),
            ],
            None,
        );
    }

    #[test]
    fn lip_in_many_textfield_items() {
        use edvo_model::property::content::{DataChunk, DataChunks};
        let chunks: DataChunks = vec![
            DataChunk::text("The "),
            DataChunk::edge("dog_id"),
            DataChunk::text(" eats"),
        ]
        .into();

        check(
            &chunks,
            Some(0),
            [
                TextFieldItem::text("The "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" eats"),
            ],
            Some(0),
        );
        check(
            &chunks,
            Some(2),
            [
                TextFieldItem::text("Th"),
                TextFieldItem::text("e "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" eats"),
            ],
            Some(1),
        );
        check(
            &chunks,
            Some(4),
            [
                TextFieldItem::text("The "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" eats"),
            ],
            Some(1),
        );
        check(
            &chunks,
            Some(5),
            [
                TextFieldItem::text("The "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" eats"),
            ],
            Some(2),
        );
        check(
            &chunks,
            Some(8),
            [
                TextFieldItem::text("The "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" ea"),
                TextFieldItem::text("ts"),
            ],
            Some(3),
        );
        check(
            &chunks,
            Some(10),
            [
                TextFieldItem::text("The "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" eats"),
            ],
            Some(3),
        );
        check(
            &chunks,
            Some(12),
            [
                TextFieldItem::text("The "),
                TextFieldItem::edge("dog_id"),
                TextFieldItem::text(" eats"),
            ],
            None,
        );
    }
}
