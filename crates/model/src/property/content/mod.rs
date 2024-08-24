pub mod content_type;
pub mod text_range_offset;

pub mod text;
pub(crate) use text::Content;

mod data_chunks;
pub use data_chunks::*;

use std::{fmt::Debug, rc::Rc};

use unicode_segmentation::UnicodeSegmentation;
use wasm_bindgen::prelude::wasm_bindgen;
use yrs::types::text::{Diff, YChange};

use crate::utils::helpers::len_utf16_gr;

#[wasm_bindgen]
#[derive(Debug, Clone)]
pub struct ContentState(Rc<[DataChunk]>);

impl Default for ContentState {
    // ensures there is no empty array case
    fn default() -> Self {
        Self::from_string("".into())
    }
}

#[wasm_bindgen]
impl ContentState {
    pub fn from_string(text: String) -> ContentState {
        ContentState(Rc::new([DataChunk::Text(text.into())]))
    }

    // pub fn null() -> ContentState {
    //     ContentState(Rc::new([]))
    // }

    // pub fn is_null(&self) -> bool {
    //     self.0.is_empty()
    // }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty() || self.0.iter().all(|chunk| chunk.is_empty())
    }

    /// Lengh in bytes or characters, depending on the type of content
    #[wasm_bindgen(getter)]
    pub fn length(&self) -> usize {
        let mut len = 0;
        for chunk in self.0.iter() {
            len += chunk.len();
        }
        len
    }

    // #[wasm_bindgen(getter, js_name = "chunks")]
    // pub fn js_chunks(&self) -> ChunkIter {
    //     ChunkIter {
    //         offset: 0,
    //         state: self.clone(),
    //     }
    // }

    pub fn to_lossy_string(&self) -> String {
        let mut string = "".to_string();
        for chunk in self.chunks() {
            if let DataChunk::Text(s) = chunk {
                string.push_str(s);
            }
        }
        string
    }

    #[wasm_bindgen]
    pub fn nth_grapheme(&self, mut n: usize) -> Option<String> {
        for chunk in self.chunks() {
            if let DataChunk::Text(s) = chunk {
                let grs = grapheme_indices_utf16_offsets(s);
                let len = grs
                    .iter()
                    .last()
                    .map(|g| g.utf16_offset + len_utf16_gr(g.grapheme))?;

                // This means the cursor is at the end of the content, which is a newline,
                // indicating that it's an empty string; hence, we return `None`.
                if len == n {
                    return None;
                }

                if n < len {
                    match grs.binary_search_by(|g| g.utf16_offset.cmp(&n)) {
                        Ok(i) => return Some(grs[i].grapheme.to_string()),
                        Err(i) => {
                            if i > grs.len() {
                                return None;
                            }
                            return Some(grs[i - 1].grapheme.to_string());
                        }
                    }
                }

                n -= len + 1; // 1 is for the newline character
            }
        }

        None
    }
}

impl AsRef<[DataChunk]> for ContentState {
    fn as_ref(&self) -> &[DataChunk] {
        &self.0
    }
}
impl Chunkable for ContentState {}

impl<T: AsRef<[DataChunk]>> PartialEq<T> for ContentState {
    fn eq(&self, other: &T) -> bool {
        let this = &*self.0;
        let other = other.as_ref();
        this.len() == other.len() && this.iter().zip(other.iter()).all(|(a, b)| a == b)
    }
}

impl PartialEq<[DataChunk]> for ContentState {
    fn eq(&self, other: &[DataChunk]) -> bool {
        let this = &*self.0;
        this.len() == other.len() && this.iter().zip(other.iter()).all(|(a, b)| a == b)
    }
}

impl<T: Into<DataChunks>> From<T> for ContentState {
    fn from(value: T) -> Self {
        let mut chunks: DataChunks = value.into();
        // ensures there is at least one chunk
        if chunks.is_empty() {
            chunks.push("".into())
        }

        ContentState(chunks.into())
    }
}

// #[wasm_bindgen]
// pub struct ChunkIter {
//     offset: usize,
//     state: ContentState,
// }

// #[wasm_bindgen]
// impl ChunkIter {
//     #[wasm_bindgen(js_name = "next")]
//     pub fn js_next(&mut self) -> Option<ChunkRef> {
//         self.next()
//     }

//     pub fn reset(&mut self) {
//         self.offset = 0;
//     }
// }

// impl std::iter::Iterator for ChunkIter {
//     type Item = ChunkRef;

//     fn next(&mut self) -> Option<Self::Item> {
//         if self.offset < self.state.0.len() {
//             let chunk = ChunkRef {
//                 state: self.state.clone(),
//                 offset: self.offset,
//             };

//             self.offset += 1;
//             Some(chunk)
//         } else {
//             None
//         }
//     }
// }

// /// `ChunkRef` represents a reference to ChunkData
// #[derive(Clone)]
// #[wasm_bindgen]
// pub struct ChunkRef {
//     state: ContentState,
//     offset: usize,
// }

// impl Deref for ChunkRef {
//     type Target = DataChunk;

//     fn deref(&self) -> &Self::Target {
//         &self.state.0[self.offset]
//     }
// }

// #[wasm_bindgen]
// impl ChunkRef {
//     #[wasm_bindgen(js_name = "string")]
//     pub fn js_string(&self) -> Option<JsString> {
//         match &**self {
//             DataChunk::Text(text) => Some(JsString::from(&text[..])),
//             _ => None,
//         }
//     }

//     pub fn edge_id(&self) -> Option<JsString> {
//         match &**self {
//             DataChunk::Edge(edge_id) => Some(JsString::from(&edge_id[..])),
//             _ => None,
//         }
//     }
// }

// impl ChunkRef {
//     pub fn as_str(&self) -> Option<&str> {
//         match &**self {
//             DataChunk::Text(text) => Some(text.as_str()),
//             _ => None,
//         }
//     }
//     pub fn to_string(&self) -> Option<String> {
//         match &**self {
//             DataChunk::Text(text) => Some(text.clone()),
//             _ => None,
//         }
//     }
// }

// impl Drop for ChunkRef {
//     fn drop(&mut self) {}
// }

impl From<Diff<YChange>> for DataChunk {
    fn from(value: Diff<YChange>) -> Self {
        use yrs::Any;
        let any = match value.insert {
            yrs::types::Value::Any(any) => any,
            _ => return DataChunk::Unknown,
        };

        match any {
            Any::String(text) => DataChunk::Text(text),
            Any::Map(map) => {
                if let Some(Any::String(s)) = map.get("eid") {
                    DataChunk::Edge(s.to_string())
                } else {
                    // I don't know about this entity type
                    DataChunk::Unknown
                }
            }
            _ => DataChunk::Unknown,
        }
    }
}

impl From<String> for DataChunk {
    fn from(value: String) -> Self {
        DataChunk::text(value)
    }
}

impl From<&str> for DataChunk {
    fn from(value: &str) -> Self {
        DataChunk::Text(value.into())
    }
}

#[cfg_attr(test, derive(Debug, PartialEq))]
struct Grapheme<'gr> {
    byte_offset: usize,
    utf16_offset: usize,
    grapheme: &'gr str,
}

/// Returns an iterator over the grapheme clusters of `text` and their "unit" offsets in UTF-16.
///
/// NOTE: There is a method called [`unicode_segmentation::UnicodeSegmentation::grapheme_indices`],
/// but the version below is different in that it returns
/// an iterator over the grapheme clusters of the text and their UTF-16 offsets
/// instead of byte offsets.
///
/// For example,
///
/// ```
/// use unicode_segmentation::UnicodeSegmentation;
///
/// let s = "hi 👨‍🎨!";
/// let gr_inds = UnicodeSegmentation::grapheme_indices(s, true).collect::<Vec<(usize, &str)>>();
///
/// assert_eq!(gr_inds, [(0, "h"), (1, "i"), (2, " "), (3, "👨\u{200d}🎨"), (14, "!")]);
/// ```
///
/// This might be useful in some cases, but for our purpose, we need to know the "unit" offsets
/// of the grapheme clusters in the string rather than the byte offsets.
///
/// Therefore, by using this approach, we obtain:
/// ```
/// [
///     Grapheme {
///         byte_offset: 0,
///         utf16_offset: 0,
///         grapheme: "h"
///     },
///     Grapheme {
///         byte_offset: 1,
///         utf16_offset: 1,
///         grapheme: "i"
///     },
///     Grapheme {
///         byte_offset: 2,
///         utf16_offset: 2,
///         grapheme: " "
///     },
///     Grapheme {
///         byte_offset: 3,
///         utf16_offset: 3,
///         grapheme: "👨\u{200d}🎨"
///     },
///     Grapheme {
///         byte_offset: 14,
///         utf16_offset: 8,
///         grapheme: "!"
///     }
/// ]
/// ```
/// , which is what we require to correctly move the text cursor forward or backward.
///
fn grapheme_indices_utf16_offsets<'gr>(s: &str) -> Vec<Grapheme> {
    UnicodeSegmentation::grapheme_indices(s, true)
        .scan(0, |state, (i, g)| {
            let offset = *state;
            *state += len_utf16_gr(g);
            Some(Grapheme {
                byte_offset: i,
                utf16_offset: offset,
                grapheme: g,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nth_grapheme() {
        let content = ContentState(Rc::new([
            DataChunk::text("Hi, "),
            DataChunk::text("👨‍🎨"),
            DataChunk::text("!"),
        ]));

        // first chunk
        assert_eq!(content.nth_grapheme(0), Some("H".to_string()));
        assert_eq!(content.nth_grapheme(1), Some("i".to_string()));
        assert_eq!(content.nth_grapheme(2), Some(",".to_string()));
        assert_eq!(content.nth_grapheme(3), Some(" ".to_string()));
        assert_eq!(content.nth_grapheme(4), None); // newline : end of first chunk

        // second chunk
        assert_eq!(content.nth_grapheme(5), Some("👨\u{200d}🎨".to_string())); // first index of emoji
        assert_eq!(content.nth_grapheme(6), Some("👨\u{200d}🎨".to_string())); // inside emoji
        assert_eq!(content.nth_grapheme(7), Some("👨\u{200d}🎨".to_string())); // inside emoji
        assert_eq!(content.nth_grapheme(8), Some("👨\u{200d}🎨".to_string())); // inside emoji
        assert_eq!(content.nth_grapheme(9), Some("👨\u{200d}🎨".to_string())); // last index of emoji
        assert_eq!(content.nth_grapheme(10), None); // newline : end of second chunk

        // third chunk
        assert_eq!(content.nth_grapheme(11), Some("!".to_string()));
        assert_eq!(content.nth_grapheme(12), None); // newline : end of third chunk

        // totally out of bounds
        assert_eq!(content.nth_grapheme(100), None);
    }

    #[test]
    fn test_grapheme_indices_utf16_offsets() {
        let s = "hi 👨‍🎨!";
        let grs = grapheme_indices_utf16_offsets(s);

        assert_eq!(
            grs,
            [
                Grapheme {
                    byte_offset: 0,
                    utf16_offset: 0,
                    grapheme: "h"
                },
                Grapheme {
                    byte_offset: 1,
                    utf16_offset: 1,
                    grapheme: "i"
                },
                Grapheme {
                    byte_offset: 2,
                    utf16_offset: 2,
                    grapheme: " "
                },
                Grapheme {
                    byte_offset: 3,
                    utf16_offset: 3,
                    grapheme: "👨\u{200d}🎨"
                },
                Grapheme {
                    byte_offset: 14,
                    utf16_offset: 8,
                    grapheme: "!"
                }
            ]
        );
    }
}
