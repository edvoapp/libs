use super::grapheme_indices_utf16_offsets;
use crate::utils::helpers::len_utf16_str;

use std::{ops::Deref, rc::Rc, sync::Arc};

use yrs::types::text::{Diff, YChange};

#[derive(Debug)]
pub struct DataChunks(Vec<DataChunk>);

impl Default for DataChunks {
    fn default() -> Self {
        DataChunks(vec![DataChunk::text("")])
    }
}

impl From<Vec<DataChunk>> for DataChunks {
    fn from(value: Vec<DataChunk>) -> Self {
        Self(value)
    }
}

impl IntoIterator for DataChunks {
    type Item = DataChunk;

    type IntoIter = std::vec::IntoIter<DataChunk>;

    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum DataChunk {
    Text(Arc<str>),
    Edge(String),
    // Binary()
    Unknown,
}

impl DataChunk {
    pub fn text(text: impl Into<Arc<str>>) -> DataChunk {
        DataChunk::Text(text.into())
    }

    pub fn edge(edge_id: impl Into<String>) -> DataChunk {
        DataChunk::Edge(edge_id.into())
    }

    pub fn len(&self) -> usize {
        match self {
            DataChunk::Text(s) => len_utf16_str(s),
            DataChunk::Edge(_) => 1,
            DataChunk::Unknown => 1,
        }
    }

    pub fn is_empty(&self) -> bool {
        match self {
            DataChunk::Text(s) => s.is_empty(),
            DataChunk::Edge(_) => false,
            DataChunk::Unknown => false,
        }
    }

    /// Split a chunk at offset if possible
    ///
    /// ```
    /// use edvo_model::property::content::DataChunk;
    ///
    /// let chunk = DataChunk::text("The dog");
    /// assert_eq!(chunk.split_at(0), None);
    /// assert_eq!(chunk.split_at(4).unwrap(), (DataChunk::text("The "), DataChunk::text("dog")));
    /// assert_eq!(chunk.split_at(7), None);
    /// assert_eq!(chunk.split_at(10), None);
    /// ```
    pub fn split_at(&self, offset: usize) -> Option<(DataChunk, DataChunk)> {
        match self {
            DataChunk::Text(text) => {
                if offset == 0 || len_utf16_str(text) <= offset {
                    None
                } else {
                    let grs = grapheme_indices_utf16_offsets(text);
                    let offset = match grs.binary_search_by(|g| g.utf16_offset.cmp(&offset)) {
                        Ok(i) => grs[i].byte_offset,
                        Err(i) => {
                            if i > grs.len() {
                                return None;
                            }
                            grs[i - 1].byte_offset
                        }
                    };

                    Some((
                        DataChunk::text(&text[0..offset]),
                        DataChunk::text(&text[offset..]),
                    ))
                }
            }
            DataChunk::Edge(_) => None,
            DataChunk::Unknown => None,
        }
    }
}

impl From<Vec<String>> for DataChunks {
    fn from(value: Vec<String>) -> Self {
        Self(value.into_iter().map(|s| s.into()).collect())
    }
}

impl<T: Into<DataChunk>> From<T> for DataChunks {
    fn from(value: T) -> Self {
        Self(vec![value.into()])
    }
}

impl From<Vec<Diff<YChange>>> for DataChunks {
    fn from(value: Vec<Diff<YChange>>) -> Self {
        Self(value.into_iter().map(|s| s.into()).collect())
    }
}

impl DataChunks {
    pub fn push(&mut self, chunk: DataChunk) {
        self.0.push(chunk)
    }
}

pub trait Chunkable: AsRef<[DataChunk]> {
    fn content_len(&self) -> usize {
        self.as_ref().iter().map(|c| c.len()).sum()
    }

    fn len(&self) -> usize {
        self.as_ref().len()
    }

    fn is_empty(&self) -> bool {
        self.as_ref().is_empty()
    }

    fn chunks(&self) -> core::slice::Iter<'_, DataChunk> {
        self.as_ref().iter()
    }

    /// Refines the datachunks at a index if this is in the middle of a chunk
    ///
    /// ```text
    /// The [dog] eats
    /// ^0  ^4  ^5    ^10
    ///         
    /// refines_at(0) => nothing to refine
    /// refines_at(2) => "Th", "e ", [dog], " eats"
    /// refines_at(4) => nothing to refine
    /// refines_at(5) => nothing to refine
    /// refienes_at(8) => "the ", [dog], " ea", "ts"
    /// refines_at(10) => nothing to refine
    /// ```
    ///  
    /// ```
    /// use edvo_model::property::content::{DataChunks, DataChunk, Chunkable};
    ///
    /// let chunks: DataChunks = vec![DataChunk::text("The "), DataChunk::edge("dog_id"), DataChunk::text(" eats")].into();
    /// assert_eq!(chunks.refine_at(0), None);
    /// assert_eq!(chunks.refine_at(4), None);
    /// assert_eq!(chunks.refine_at(5), None);
    /// assert_eq!(chunks.refine_at(10), None);
    ///
    /// let refined_chunks = chunks.refine_at(2).unwrap();
    /// assert_eq!(refined_chunks, [DataChunk::text("Th"), DataChunk::text("e "), DataChunk::edge("dog_id"), DataChunk::text(" eats")]);
    ///
    /// let refined_chunks = chunks.refine_at(8).unwrap();
    /// assert_eq!(refined_chunks, [DataChunk::text("The "), DataChunk::edge("dog_id"), DataChunk::text(" ea"), DataChunk::text("ts")]);
    /// ```
    fn refine_at(&self, index: u32) -> Option<DataChunks> {
        if index == 0 {
            return None;
        }

        let mut wanted = index as usize;
        let chunks = self.as_ref();
        for (idx, chunk) in chunks.iter().enumerate() {
            let chunk_len = chunk.len();
            match wanted.cmp(&chunk_len) {
                std::cmp::Ordering::Less => {
                    let mut chunks_vec = Vec::new();
                    for chunk in &chunks[0..idx] {
                        chunks_vec.push(chunk.clone());
                    }
                    match chunk {
                        DataChunk::Text(text) => {
                            chunks_vec.push(DataChunk::Text(text[0..wanted].into()));
                            chunks_vec.push(DataChunk::Text(text[wanted..].into()));
                        }
                        DataChunk::Edge(_) => unreachable!("Edges can not be splitted"),
                        DataChunk::Unknown => unreachable!("Unknown embed can not be splitted"),
                    }
                    for chunk in &chunks[(idx + 1)..] {
                        chunks_vec.push(chunk.clone());
                    }
                    return Some(chunks_vec.into());
                }
                std::cmp::Ordering::Equal => return None,
                std::cmp::Ordering::Greater => wanted -= chunk_len,
            }
        }

        None
    }
}

impl Chunkable for DataChunks {}

impl core::ops::Index<usize> for DataChunks {
    type Output = DataChunk;

    fn index(&self, index: usize) -> &Self::Output {
        self.as_ref().index(index)
    }
}

impl AsRef<[DataChunk]> for DataChunks {
    fn as_ref(&self) -> &[DataChunk] {
        self.0.as_ref()
    }
}

impl<T: AsRef<[DataChunk]>> PartialEq<T> for DataChunks {
    fn eq(&self, other: &T) -> bool {
        let this = &self.0;
        let other = other.as_ref();
        this.len() == other.len() && this.iter().zip(other.iter()).all(|(x, y)| *x == *y)
    }
}

impl Deref for DataChunks {
    type Target = [DataChunk];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl From<DataChunks> for Rc<[DataChunk]> {
    fn from(chunks: DataChunks) -> Self {
        chunks.0.into()
    }
}
