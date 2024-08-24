pub mod item;
use std::{cell::RefCell, ops::Deref, rc::Rc};

use item::*;

use edvo_model::{
    property::{
        content::{text::Content, text_range_offset::ContentRangeOffsets, ContentState},
        Property,
    },
    text_range::{TextContentPosition, TextContentRange},
    utils::helpers::len_utf16_str,
};

use observable_rs::{MapReader, Reader, Value};
use wasm_bindgen::prelude::wasm_bindgen;

use crate::ViewModelNode;

#[wasm_bindgen(js_name = "VM_TextField")]
pub struct TextField {
    content: Rc<Value<ContentManager>>,
    lozenge_insertion_position: Rc<Value<Option<TextContentPosition>>>,
    items: MapReader<TextItemsAndLip>,
    offsets: RefCell<Option<TextContentRange>>,
    allowed_lozenges: bool,
}

impl ViewModelNode for TextField {}

impl Default for TextField {
    fn default() -> Self {
        Self::new(ContentManager::default(), true)
    }
}

impl TextField {
    pub fn new(content: ContentManager, allow_lozenges: bool) -> Self {
        let content = Value::rc(content);
        let lozenge_insertion_position: Rc<Value<Option<TextContentPosition>>> = Rc::default();

        let items = {
            let content = content.clone();
            let lip = lozenge_insertion_position.clone();
            MapReader::new_dyn(move |ctx| {
                let lip = lip.get();
                let content_manager = content.get();

                let content_state_obs = content_manager.obs();
                let cs = ctx.track_dyn(&content_state_obs);

                let lip = lip.as_ref().and_then(|c| c.get_offset());
                TextItemsAndLip::calculate(cs.deref(), lip)
            })
        };

        Self {
            content,
            items,
            lozenge_insertion_position,
            offsets: RefCell::default(),
            allowed_lozenges: allow_lozenges,
        }
    }
}

#[wasm_bindgen(js_class = VM_TextField)]
impl TextField {
    pub fn ephemeral(allow_lozenges: bool) -> Self {
        Self::new(ContentManager::new(), allow_lozenges)
    }

    pub fn new_with_property(property: &Property, allow_lozenges: bool, autosave: bool) -> Self {
        let content_manager = ContentManager::from_property(property.clone(), autosave);
        Self::new(content_manager, allow_lozenges)
    }

    #[wasm_bindgen(getter)]
    pub fn content_state(&self) -> ContentState {
        self.content.get().obs().value_cloned()
    }

    #[wasm_bindgen(getter)]
    pub fn is_empty(&self) -> bool {
        self.content.get().obs().value().is_empty()
    }

    #[wasm_bindgen(getter)]
    pub fn allowed_lozenges(&self) -> bool {
        self.allowed_lozenges
    }

    /// Returns true if the content was updated
    pub fn set_lozenge_caret(&self) -> bool {
        if !self.allowed_lozenges() {
            return false;
        }
        let content = self.content.get();

        let mut udpated = false;
        if let Some(range) = self.offsets() {
            let start = range.min();
            let len = range.length();

            if len != 0 {
                content.remove_range(start, len);
                content.maybe_debounce_save();
                udpated = true;
            }
            let pos = content.get_position(start);
            self.set_lip(pos);
        }
        udpated
    }

    pub fn remove_lozenge_caret(&self) {
        self.set_lip(None)
    }
    pub fn try_lozenge_caret_to_offsets(&self) {
        {
            if let Some(lip) = { self.lozenge_insertion_position.get().as_ref() } {
                if let Some(offset) = lip.get_offset() {
                    self.set_offsets(self.content.get().get_range(offset, offset))
                }
            }
        }
        self.remove_lozenge_caret()
    }

    #[wasm_bindgen(js_name = "set_content_poperty_info")]
    pub fn set_content_poperty_info(&self, property: &Property, autosave: bool) {
        let previous_offsets = self.offsets();

        let content = ContentManager::from_property(property.clone(), autosave);

        self.set_offsets(None);
        let new_offsets = previous_offsets.and_then(|range| {
            let new_len = content.len();
            let start = range.start().min(new_len);
            let end = range.end().min(new_len);
            content.get_range(start, end)
        });

        self.content.set(content);
        self.set_offsets(new_offsets);
        self.items.recalculate();
    }
    pub fn reset_content(&self) {
        let content = ContentManager::new();
        let new_offsets = content.get_range(0, 0);

        self.set_offsets(None);
        self.content.set(content);
        self.set_offsets(new_offsets);

        self.items.recalculate();
    }

    #[wasm_bindgen(js_name = "on_items_updated")]
    pub fn js_on_items_updated(
        &self,
        f: item::js::VoidCallback,
        immediate: bool,
    ) -> item::js::VoidCallbackOnce {
        let cb = move || {
            f.call().unwrap();
        };

        self.on_items_updated(cb, immediate).into()
    }
    #[wasm_bindgen(getter, js_name = "items")]
    pub fn js_items(&self) -> item::js::TextFieldItemArray {
        let obj = self.items.value();
        item::js::TextFieldItemArray::from(obj.items())
    }
    #[wasm_bindgen(getter, js_name = "lip")]
    pub fn js_lip(&self) -> Option<usize> {
        self.items.value().lip()
    }

    pub fn clear_content(&self) -> bool {
        self.content.get().clear_content()
    }

    pub fn insert_string(&self, string: String) {
        let content = self.content.get();
        let range = self.offsets().unwrap_or_default();
        let start = range.min();
        let len = range.length();

        if len != 0 {
            content.remove_range(start, len);
        }

        let width = len_utf16_str(&string) as u32;
        let offset = start + width;

        content.insert_string(start, string);
        content.maybe_debounce_save();

        let new_offsets = content.get_range(offset, offset);
        self.set_offsets(new_offsets);
    }

    pub fn insert_edge(&self, edge_id: String) {
        if !self.allowed_lozenges() {
            return;
        }
        let content = self.content.get();
        let range = self.offsets().unwrap_or_default();

        let start = range.min();
        let len = range.length();
        if len != 0 {
            content.remove_range(start, len);
        }

        content.insert_edge(start, edge_id);

        let offset = start + 1;
        let new_offsets = content.get_range(offset, offset);

        content.maybe_debounce_save();
        self.set_offsets(new_offsets);
    }

    pub fn remove_characters(&self) -> bool {
        let range = self.offsets().unwrap_or_default();

        let start = range.min();
        let len = range.length();

        let content = self.content.get();
        let (new_offsets, updated) = if len != 0 {
            content.remove_range(start, len);
            (content.get_range(start, start), true)
        } else if start > 0 {
            content.remove_at(start);
            let offset = start - 1;
            (content.get_range(offset, offset), true)
        } else {
            (content.get_range(start, start), false)
        };
        self.set_offsets(new_offsets);
        content.maybe_debounce_save();
        updated
    }

    pub fn remove_range(&self, index: u32, length: u32) -> bool {
        if length == 0 {
            return false;
        }
        let content = self.content.get();
        content.remove_range(index, length);
        content.maybe_debounce_save();
        true
    }

    #[wasm_bindgen(getter)]
    pub fn offsets(&self) -> Option<ContentRangeOffsets> {
        self.offsets
            .borrow()
            .as_ref()
            .and_then(|range| range.get_offsets())
    }

    #[wasm_bindgen(js_name = "set_offsets")]
    pub fn js_set_offsets(&self, start: u32, end: u32) {
        self.set_offsets(self.content.get().get_range(start, end));
    }

    pub fn clear_offsets(&self) {
        self.set_offsets(None);
    }
}

impl TextField {
    pub fn on_items_updated(&self, cb: impl Fn() + 'static, immediate: bool) -> Box<dyn FnOnce()> {
        if immediate {
            cb()
        }

        let sub = self.items.on_updated(cb);
        Box::new(move || drop(sub))
    }

    fn set_offsets(&self, new_offsets: Option<TextContentRange>) {
        self.offsets.replace(new_offsets);

        // HACK: notifies without recalculation
        self.items.force_notify();
    }
    fn set_lip(&self, lip: Option<TextContentPosition>) {
        self.lozenge_insertion_position.set(lip);
        self.items.recalculate();
    }

    pub fn items_and_lic(&self) -> Reader<TextItemsAndLip> {
        self.items.reader()
    }
}

#[derive(Clone)]
pub struct PropertyInfo {
    property: Property,
    autosave: bool,
}

pub enum ContentManager {
    Content(Content),
    PropInfo(PropertyInfo),
}

impl ContentManager {
    pub fn new() -> Self {
        ContentManager::Content(Content::new())
    }

    pub fn from_property(property: Property, autosave: bool) -> ContentManager {
        ContentManager::PropInfo(PropertyInfo { property, autosave })
    }

    pub fn maybe_debounce_save(&self) {
        match self {
            ContentManager::Content(_) => {}
            ContentManager::PropInfo(info) => {
                if info.autosave {
                    info.property.debounce_save()
                }
            }
        }
    }

    pub fn clear_content(&self) -> bool {
        match self {
            ContentManager::Content(content) => content.clear_content(),
            ContentManager::PropInfo(info) => {
                let updated = info.property.content.clear_content();
                if info.autosave {
                    info.property.debounce_save()
                }
                updated
            }
        }
    }
}

impl Default for ContentManager {
    fn default() -> Self {
        Self::new()
    }
}

impl Deref for ContentManager {
    type Target = Content;

    fn deref(&self) -> &Self::Target {
        match self {
            ContentManager::Content(c) => c,
            ContentManager::PropInfo(p) => p.property.content.deref(),
        }
    }
}
