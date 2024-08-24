use std::cell::RefCell;

use observable_rs::{Observable, Reader};
use wasm_bindgen::prelude::wasm_bindgen;
use yrs::{self, ReadTxn, Text, TextRef, Transact, Update};
use yrs::{types::text::YChange, updates::decoder::Decode};

use crate::text_range::{TextContentPosition, TextContentRange};

use super::{ContentState, DataChunk, DataChunks};

// Important to not create a new yrs::TEXT object with .get_text()
const TEXT_NAME: &str = "";

/**
 * We would store updateArray, but we don't need to because the Doc does that for us
 * All property will have or more content_string fields representing their saved state
 */
#[wasm_bindgen(js_name = TextContent)]
pub struct Content {
    doc: yrs::Doc, // interior mutability
    presumed_server_state: RefCell<yrs::StateVector>,
    state: Observable<ContentState>,
}

impl Default for Content {
    fn default() -> Self {
        Self {
            doc: yrs::Doc::with_options(yrs::Options {
                offset_kind: yrs::OffsetKind::Utf16,
                ..Default::default()
            }),
            presumed_server_state: Default::default(),
            state: Default::default(),
        }
    }
}

impl From<(&[u8], &[usize])> for Content {
    fn from((updates, update_lengths): (&[u8], &[usize])) -> Self {
        let content = Content::new();
        content.apply_updates_from_db(updates, update_lengths);
        content
    }
}

impl From<String> for Content {
    fn from(legacy_content: String) -> Self {
        let content = Content::new();
        content.insert_chunk(0, legacy_content);
        content
    }
}

impl From<&str> for Content {
    fn from(legacy_content: &str) -> Self {
        let content = Content::new();
        content.insert_chunk(0, legacy_content.to_owned());
        content
    }
}

impl<T: Into<Content>> From<Option<T>> for Content {
    fn from(value: Option<T>) -> Self {
        if let Some(val) = value {
            val.into()
        } else {
            Content::new()
        }
    }
}

impl Content {
    pub fn text(&self) -> TextRef {
        self.doc.get_or_insert_text(TEXT_NAME)
    }

    #[allow(dead_code)]
    pub fn len(&self) -> u32 {
        let text = self.text();
        let txn = text.transact();
        text.len(&txn)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn apply_updates_from_db(&self, updates: &[u8], update_lengths: &[usize]) {
        {
            let text = self.text();
            let mut remote_trx = text.transact_mut();
            let mut start = 0;
            for length in update_lengths {
                let end = start + length;
                let update = &updates[start..end];

                if let Ok(update) = Update::decode_v1(update) {
                    remote_trx.apply_update(update);
                }
                start = end; // for next time
            }
        }
        self.notify_state();
    }

    pub fn replace_content(&self, content: String) {
        {
            let text = self.text();
            let mut remote_trx = text.transact_mut();
            let len = text.len(&remote_trx);
            text.remove_range(&mut remote_trx, 0, len);
            text.insert(&mut remote_trx, 0, &content);
        }
        self.notify_state();
    }

    pub fn insert_chunk(&self, index: u32, chunk: impl Into<DataChunk>) {
        {
            let text = self.text();
            let mut txn = text.transact_mut();

            let chunk = chunk.into();
            match chunk {
                DataChunk::Text(ref s) => text.insert(&mut txn, index, s),
                DataChunk::Edge(edge_id) => {
                    let map = yrs::any!({ "eid": edge_id });
                    text.insert_embed(&mut txn, index, map);
                }
                DataChunk::Unknown => unreachable!("Unknown chunk must not be inserted"),
            }
        }
        self.notify_state();
    }

    pub fn remove_range(&self, index: u32, len: u32) {
        if len == 0 {
            return;
        }

        {
            let text = self.text();
            let mut txn = text.transact_mut();
            text.remove_range(&mut txn, index, len);
        }

        self.notify_state()
    }

    pub fn remove_at(&self, index: u32) {
        if index == 0 {
            return;
        }
        self.remove_range(index - 1, 1);
        self.notify_state();
    }

    // TODO: Refactor to accept a list of chunks
    pub fn replace_range(&self, index: u32, length: u32, new_chunk: impl Into<DataChunk>) {
        self.remove_range(index, length);
        self.insert_chunk(index, new_chunk);
    }
    pub fn clear_content(&self) -> bool {
        let len = self.len();
        if len > 0 {
            self.remove_range(0, len);
            true
        } else {
            false
        }
    }

    pub fn take_update_to_send(&self) -> Vec<u8> {
        let txn = self.doc.transact();

        let mut presumed_server_state = self.presumed_server_state.borrow_mut();
        let update_to_send = txn.encode_diff_v1(&presumed_server_state);
        *presumed_server_state = txn.state_vector();

        update_to_send
    }

    /// Get the present ContentState inclusive of any unsaved writes
    pub fn content(&self) -> DataChunks {
        let text = self.text();
        let txn = text.transact();
        text.diff(&txn, YChange::identity).into()
    }

    /// Provide sticky indexes for a range
    pub fn get_range(&self, start: u32, end: u32) -> Option<TextContentRange> {
        let text = self.text();
        TextContentRange::from_offsets(&text, start, end)
    }

    /// Provide sticky indexes for a position
    pub fn get_position(&self, offset: u32) -> Option<TextContentPosition> {
        let text = self.text();
        TextContentPosition::from_offset(&text, offset)
    }

    pub fn obs(&self) -> Reader<ContentState> {
        self.state.reader()
    }

    fn notify_state(&self) {
        let content = self.content();
        self.state.set(content.into())
    }
}

#[wasm_bindgen(js_class = TextContent)]
impl Content {
    #[inline]
    pub fn new() -> Self {
        Content::default()
    }
    pub fn insert_string(&self, index: u32, string: String) {
        self.insert_chunk(index, string);
    }

    pub fn insert_edge(&self, index: u32, edge_id: String) {
        self.insert_chunk(index, DataChunk::Edge(edge_id));
    }
}

#[cfg(test)]
mod test {
    use super::Content;
    use crate::property::content::{
        Chunkable, ContentState,
        DataChunk::{self, *},
    };

    #[test]
    fn text_with_content_state_non_null() {
        let text = Content::new();
        let content: ContentState = text.content().into();
        // assert!(!content.is_null());

        let chunks: Vec<_> = content.chunks().cloned().collect();
        assert_eq!(chunks, [Text("".into())]);
    }

    #[test]
    fn text_insert_string_and_edge() {
        let text = Content::from("hello");
        assert_eq!(text.len(), 5);
        let content: ContentState = text.content().into();
        assert_eq!(content.length(), 5);

        text.insert_chunk(3, "__".to_string());
        let content: ContentState = text.content().into();
        assert_eq!(text.len(), 7);
        assert_eq!(content.length(), 7);
        let chunks: Vec<_> = content.chunks().map(|c| (*c).clone()).collect();
        assert_eq!(chunks, [Text("hel__lo".into())]);

        text.insert_chunk(4, Edge("asdf".to_string()));
        let content: ContentState = text.content().into();
        assert_eq!(text.len(), 8);
        assert_eq!(content.length(), 8);
        let chunks: Vec<DataChunk> = content.chunks().map(|c| (*c).clone()).collect();
        assert_eq!(
            chunks,
            [
                Text("hel_".into()),
                Edge("asdf".to_string()),
                Text("_lo".into())
            ]
        );
    }

    #[test]
    fn text_remove_ange() {
        let text = Content::from("hello");

        text.remove_range(2, 0);
        let content: ContentState = text.content().into();
        let chunks: Vec<_> = content.chunks().map(|c| (*c).clone()).collect();
        assert_eq!(chunks, [Text("hello".into())]);

        text.remove_range(2, 2);
        let content: ContentState = text.content().into();
        let chunks: Vec<_> = content.chunks().map(|c| (*c).clone()).collect();
        assert_eq!(chunks, [Text("heo".into())]);
    }

    #[test]
    fn text_remove_at() {
        let text = Content::from("hello world");

        text.insert_chunk(5, Edge("asdf".to_string()));

        text.remove_at(0);
        let content: ContentState = text.content().into();
        let chunks: Vec<_> = content.chunks().cloned().collect();
        assert_eq!(
            chunks,
            [
                Text("hello".into()),
                Edge("asdf".to_string()),
                Text(" world".into())
            ]
        );

        text.remove_at(2);
        let content: ContentState = text.content().into();
        let chunks: Vec<_> = content.chunks().cloned().collect();
        assert_eq!(
            chunks,
            [
                Text("hllo".into()),
                Edge("asdf".to_string()),
                Text(" world".into())
            ]
        );

        text.remove_at(5);
        let content: ContentState = text.content().into();
        let chunks: Vec<_> = content.chunks().cloned().collect();
        assert_eq!(chunks, [Text("hllo world".into())]);

        text.remove_at(10);
        let content: ContentState = text.content().into();
        let chunks: Vec<_> = content.chunks().cloned().collect();
        assert_eq!(chunks, [Text("hllo worl".into())]);
    }
}
