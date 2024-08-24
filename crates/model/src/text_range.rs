use wasm_bindgen::prelude::wasm_bindgen;
use yrs::{StickyIndex, TextRef, Transact};

use crate::property::content::text_range_offset::ContentRangeOffsets;

/// Represents a position within a text property which is resiliant to changes
/// being applied to that text property.
/// You may store this either in memory, or serialize/deserialize it for
/// database storage or remote presence indication.

/// This is basically a thin wrapper around Yrs::StickyIndex.
/// We may decide to add business logic to TextPosition, or not
/// But at a minimum, it's useful to have the NewType for clarity
pub struct ContentPosition<T: yrs::IndexedSequence + Clone> {
    field: T,
    sticky_index: StickyIndex,
}

impl<T: yrs::IndexedSequence + Clone> ContentPosition<T> {
    pub(crate) fn from_offset(field: &T, offset: u32) -> Option<Self> {
        let sticky_index = {
            let mut txn = field.transact_mut();
            field.sticky_index(&mut txn, offset, yrs::Assoc::Before)?
        };
        let field = field.clone();
        Some(Self {
            field,
            sticky_index,
        })
    }

    pub fn get_offset(&self) -> Option<u32> {
        let txn = self.field.transact();
        let offset = self.sticky_index.get_offset(&txn)?;
        Some(offset.index)
    }
}

#[wasm_bindgen]
pub struct TextContentPosition(ContentPosition<yrs::TextRef>);

impl TextContentPosition {
    pub fn from_offset(text: &yrs::TextRef, offset: u32) -> Option<Self> {
        let position = ContentPosition::from_offset(text, offset)?;
        Some(Self(position))
    }

    pub fn get_offset(&self) -> Option<u32> {
        let txn = self.0.field.transact();
        let offset = self.0.sticky_index.get_offset(&txn)?;
        Some(offset.index)
    }
}

/// An ephemeral representation of a text Position
/// YOU MUST NOT STORE THIS because text offsets are not resiliant to edits of the text property
pub struct TextOffset(u32);

/// Represents a range of characters/embeds within a text property.
/// This is useful for things like text selection (expanded range) and text
/// carets (collapsed range) OR highlights.
/// It is directional, meaning that in cases where the user has selected from
/// right to left, the start will represent the rightmost position in the text,
/// and the end will represent the leftmost.
#[wasm_bindgen]
pub struct TextContentRange(ContentRange<yrs::TextRef>);

pub struct ContentRange<T: yrs::IndexedSequence + Clone> {
    field: T,
    start: StickyIndex,
    end: StickyIndex,
}

impl<T: yrs::IndexedSequence + Clone> ContentRange<T> {
    pub(crate) fn from_offsets(field: &T, start: u32, end: u32) -> Option<Self> {
        let (start, end) = {
            let mut txn = field.transact_mut();
            (
                field.sticky_index(&mut txn, start, yrs::Assoc::Before)?,
                field.sticky_index(&mut txn, end, yrs::Assoc::Before)?,
            )
        };
        let field = field.clone();
        Some(Self { field, start, end })
    }

    pub fn get_offsets(&self) -> Option<ContentRangeOffsets> {
        let txn = self.field.transact();
        let start: yrs::Offset = self.start.get_offset(&txn)?;
        let end = self.end.get_offset(&txn)?;
        Some(ContentRangeOffsets::new(start.index, end.index))
    }
}

// Can't wasm_bindgen this one
impl TextContentRange {
    pub(crate) fn from_offsets(text: &yrs::TextRef, start: u32, end: u32) -> Option<Self> {
        let inner = ContentRange::from_offsets(text, start, end)?;
        Some(Self(inner))
    }
}

#[wasm_bindgen]
impl TextContentRange {
    // IDEA: consider renaming this to present_offset to communicate
    //       its ephemeral nature
    pub fn get_offsets(&self) -> Option<ContentRangeOffsets> /*Option<RangeOffset>*/ {
        self.0.get_offsets()
    }
}

pub trait IndexedRangeSequence: yrs::IndexedSequence + Clone {
    fn sticky_range_index(&self, start_index: u32, end_index: u32) -> Option<ContentRange<Self>> {
        let mut txn = self.transact_mut();
        let range = ContentRange {
            field: self.clone(),
            start: self.sticky_index(&mut txn, start_index, yrs::Assoc::Before)?,
            end: self.sticky_index(&mut txn, end_index, yrs::Assoc::Before)?,
        };
        Some(range)
    }
}

impl IndexedRangeSequence for TextRef {}

#[cfg(test)]
mod basic_test {
    use yrs::{Doc, GetString, Text, TextRef, Transact};

    use super::IndexedRangeSequence;

    fn create_example(doc: &Doc, chunk: &str) -> TextRef {
        let txt = doc.get_or_insert_text("text");
        let mut txn = doc.transact_mut();
        txt.insert(&mut txn, 0, chunk);
        txt
    }

    /// Test for verifying a premise that is a base for the hole implementation
    #[test]
    fn verify_offset_branches_are_the_same() {
        let doc = Doc::new();
        let txt = create_example(&doc, "abcdef");

        let selection = txt.sticky_range_index(4, 2).unwrap();

        let txn = doc.transact();
        let start = selection.start.get_offset(&txn).unwrap();
        let end = selection.end.get_offset(&txn).unwrap();
        assert_eq!(start.branch, end.branch);
    }

    #[test]
    fn insert_on_a_collapsed_selection_in_position_zero() {
        let doc = Doc::new();
        let txt = create_example(&doc, "abcdef");

        let selection = txt
            .sticky_range_index(0, 0)
            .expect("position zero must be assingable");

        let mut txn = doc.transact_mut();
        txt.insert(&mut txn, 0, "123");
        drop(txn);

        let offsets = selection
            .get_offsets()
            .expect("RangeOffset couldn't be calculate");
        assert_eq!(offsets, (0, 0));

        let txn = doc.transact();
        let text = txt.get_string(&txn);
        assert_eq!(text, "123abcdef");
    }

    #[test]
    fn insert_on_a_collapsed_selection_in_last_position() {
        let doc = Doc::new();
        let txt = create_example(&doc, "abcdef");

        let selection = txt
            .sticky_range_index(6, 6)
            .expect("last position must be assingable");

        let mut txn = doc.transact_mut();
        txt.insert(&mut txn, 6, "123");
        drop(txn);

        let offsets = selection
            .get_offsets()
            .expect("RangeOffset couldn't be calculate");
        assert_eq!(offsets, (6, 6));

        let txn = doc.transact();
        let text = txt.get_string(&txn);
        assert_eq!(text, "abcdef123");
    }

    #[test]
    fn insert_on_the_middle_a_non_collapsed_selection_from_left_to_right() {
        let doc = Doc::new();
        let txt = create_example(&doc, "abcdef");

        let selection = txt
            .sticky_range_index(2, 4)
            .expect("position zero must be assingable");

        let mut txn = doc.transact_mut();
        txt.insert(&mut txn, 3, "123");
        drop(txn);

        let offsets = selection
            .get_offsets()
            .expect("RangeOffset couldn't be calculate");
        assert_eq!(offsets, (2, 7));

        let txn = doc.transact();
        let text = txt.get_string(&txn);
        assert_eq!(text, "abc123def");
    }

    #[test]
    fn insert_on_the_middle_a_non_collapsed_selection_from_right_to_left() {
        let doc = Doc::new();
        let txt = create_example(&doc, "abcdef");

        let selection = txt
            .sticky_range_index(4, 2)
            .expect("position zero must be assingable");
        let mut txn = doc.transact_mut();
        txt.insert(&mut txn, 3, "123");
        drop(txn);

        let offsets = selection
            .get_offsets()
            .expect("RangeOffset couldn't be calculate");
        assert_eq!(offsets, (7, 2));

        let txn = doc.transact();
        let text = txt.get_string(&txn);
        assert_eq!(text, "abc123def");
    }
}

#[cfg(test)]
mod test {
    use yrs::{IndexedSequence, Transact};

    use crate::property::content::text::Content;

    #[test]
    fn sticky_range() {
        let text = Content::from("hello");
        let content_range = text.get_range(1, 4).unwrap();
        text.remove_at(3);

        let range = content_range.get_offsets().unwrap();

        assert_eq!(range, (1, 3));
    }

    #[test]
    fn sticky_collapsed_range_on_remove_at() {
        let text = Content::from("hello");
        let content_range = text.get_range(2, 2).unwrap();
        text.remove_at(2);

        let range = content_range.get_offsets().unwrap();
        assert_eq!(range, (1, 1));
    }

    #[test]
    fn sticky_collapsed_range_on_insert() {
        let text = Content::from("hello");
        let content_range = text.get_range(2, 2).unwrap();
        text.insert_chunk(2, "a");

        let range = content_range.get_offsets().unwrap();
        assert_eq!(range, (2, 2));
    }

    #[test]
    fn sticky_collapsed_range_on_insert_at_the_end() {
        let text = Content::from("hello");
        let content_range = text.get_range(5, 5).unwrap();

        text.insert_chunk(2, "a");
        let range = content_range.get_offsets().unwrap();
        assert_eq!(range, (6, 6));

        text.insert_chunk(6, "x");
        let range = content_range.get_offsets().unwrap();
        assert_eq!(range, (6, 6));
        //content_range = text.get_range(7, 7).unwrap();
    }

    #[test]
    fn sticky_collapsed_range_on_remove_at_the_end() {
        let text = Content::from("hello");
        let mut content_range = text.get_range(5, 5).unwrap();

        text.remove_at(2);
        let range = content_range.get_offsets().unwrap();
        assert_eq!(range, (4, 4));
        content_range = text.get_range(4, 4).unwrap();

        text.remove_at(4);
        let range = content_range.get_offsets().unwrap();
        assert_eq!(range, (3, 3));
        //content_range = text.get_range(3, 3).unwrap();
    }

    #[test]
    fn alice_and_bob_collab() {
        use yrs::GetString;
        use yrs::Text;

        let doc = yrs::Doc::new();
        let text = doc.get_or_insert_text("");
        let mut txn = doc.transact_mut();

        // Alice types abc and resets her caret after each character typed
        text.insert(&mut txn, 0, "a");
        let mut caret_a = text.sticky_index(&mut txn, 1, yrs::Assoc::Before).unwrap();

        // Alice's caret: a|
        assert_eq!(caret_a.get_offset(&txn).unwrap().index, 1);

        // Alice inserts b at the current caret
        text.insert(&mut txn, 1, "b");

        // And then updates her caret
        caret_a = text.sticky_index(&mut txn, 2, yrs::Assoc::Before).unwrap();

        // Alice's caret: ab|
        assert_eq!(caret_a.get_offset(&txn).unwrap().index, 2);

        // Alice inserts c at the current caret
        text.insert(&mut txn, 2, "c");

        // And then updates her caret
        caret_a = text.sticky_index(&mut txn, 3, yrs::Assoc::Before).unwrap();

        // Alice's caret: abc|
        assert_eq!(caret_a.get_offset(&txn).unwrap().index, 3);

        // Bob clicks after c
        let caret_b = text.sticky_index(&mut txn, 3, yrs::Assoc::Before).unwrap();

        // Bob's caret: abc|
        assert_eq!(caret_b.get_offset(&txn).unwrap().index, 3);

        // Bob inserts d at his current caret
        text.insert(&mut txn, 3, "d");
        // And then updates his caret
        let caret_b = text.sticky_index(&mut txn, 4, yrs::Assoc::Before).unwrap();

        // The text is correct
        assert_eq!(text.get_string(&txn), "abcd");

        // Alice's caret is at abc|d (hasn't "moved")
        assert_eq!(caret_a.get_offset(&txn).unwrap().index, 3);

        // Bob's caret is at abcd|
        assert_eq!(caret_b.get_offset(&txn).unwrap().index, 4);
    }
}

// This will fail with an index of 2. We want 3
// the goal is to continue to represent position 3

// THIS WHOLE EXAMPLE IS NOT IN SCOPE FOR StickyIndex case
// (Frank's readonly outline, shared with me)
// * Alpha _is the *name of my_ cat*   -> <i>is the <b>name of my</i> cat</b>
//         ^ bold - inline inside the YRS doc (discuss later. not in scope)
//   * Bravo [is the name of my] dog
//           ^ Start TP   END  ^
//           ^---  new vertex created by daniel (not allowed to edit your Yrs::Doc) with two StickyIndexes stored in the new vertex selector property
//   * Charlie

// pub struct UserId(String);

// LATER when we implement text presence indication we can do something like this:
// /// Represents the caret and selection of a specific user which may be local or remote
// pub struct TextSelectionRangePresence {
//     owner: UserId,
//     last_active: Option<Timestamp>, // None for local users, fade remote user presence after ~ N seconds of inactivity
//     range: TextRange,
// }
// pub struct TextRangePresenceSet {
//     ranges: Vec<TextSelectionRangePresence>,
// }
