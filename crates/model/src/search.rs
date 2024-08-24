use std::{borrow::Cow, sync::Arc};

use once_cell::sync::Lazy;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};

use crate::property::content::{Chunkable, ContentState, DataChunk, DataChunks};
static TERM_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"\w").unwrap());
static TOKEN_STRIP: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"\W").unwrap());

// "pseudoTerms" include delimiters, and can be joined to create a faithful representation of the source text.
// "the quick brown" -> ["", "the", " ", "quick", " ", "brown", ""] -> "the quick brown"
// export function splitString(query: string): string[] {
//     return query.split(/([,._\s]+)/);
//   }

//   // strip out the non-term members of the list. This can no longer be recombined into the original source text
//   // ["", "the", " ", "quick", " ", "brown", ""] -> ["the", "quick", "brown"]
//   const termRe = new RegExp(/\w/);
//   export function filterTerms(pseudoterms: string[]): string[] {
//     return pseudoterms.filter((t) => termRe.test(t));
//   }

//   // Convert the term to a token, removing all punctuation and lowercasing.
//   const tokenStrip = new RegExp(/\W/g);
//   export function termToToken(term: string): string {
//     return term.replaceAll(tokenStrip, '').toLocaleLowerCase();
//   }

//   export function stringToTokens(s: string | undefined): string[] {
//     if (typeof s === 'undefined') return [];
//     return filterTerms(splitString(s)).map((t) => termToToken(t));
//   }

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "string[]")]
    pub type JsStringArray;
}

pub trait Words {
    fn words(&self) -> impl Iterator<Item = &str>;
}

pub trait SearchTokens: Words {
    fn iter_search_token(&self) -> impl Iterator<Item = String> {
        filter_terms(self.words().filter_map(|s| {
            let s = s.to_lowercase();
            if term_to_token(&s).is_empty() {
                None
            } else {
                Some(s)
            }
        }))
    }

    // TODO: Should this be a vec or a set?
    //
    // if the text is "My dog is eating a hot dog"
    // result:    ["my", "dog", "is", "eating", "a", "hot", "dog"]
    // whished?:  ["my", "dog", "is", "eating", "a", "hot"]
    fn search_tokens(&self) -> Vec<String> {
        self.iter_search_token().collect()
    }
    fn search_tokens_js(&self) -> JsStringArray {
        let array: js_sys::Array = self
            .iter_search_token()
            .map(|s| JsValue::from_str(&s))
            .collect();
        let s: JsValue = array.into();
        s.into()
    }
}
impl<W: Words> SearchTokens for W {}

impl Words for &str {
    fn words(&self) -> impl Iterator<Item = &str> {
        split_string(self)
    }
}
impl Words for String {
    fn words(&self) -> impl Iterator<Item = &str> {
        split_string(self)
    }
}
impl Words for Arc<str> {
    fn words(&self) -> impl Iterator<Item = &str> {
        split_string(self)
    }
}
impl Words for &[DataChunk] {
    fn words(&self) -> impl Iterator<Item = &str> {
        self.iter()
            .filter_map(|c| match c {
                DataChunk::Text(s) => Some(s.words()),
                DataChunk::Edge(_) => None,
                DataChunk::Unknown => None,
            })
            .flat_map(|s| s)
    }
}

impl Words for DataChunks {
    fn words(&self) -> impl Iterator<Item = &str> {
        self.iter()
            .filter_map(|c| match c {
                DataChunk::Text(s) => Some(s.words()),
                DataChunk::Edge(_) => None,
                DataChunk::Unknown => None,
            })
            .flat_map(|s| s)
    }
}
impl Words for ContentState {
    fn words(&self) -> impl Iterator<Item = &str> {
        self.chunks()
            .filter_map(|c| match c {
                DataChunk::Text(s) => Some(s.words()),
                DataChunk::Edge(_) => None,
                DataChunk::Unknown => None,
            })
            .flat_map(|s| s)
    }
}

fn split_string(query: &str) -> impl Iterator<Item = &str> {
    query.split(|c: char| c.is_ascii_punctuation() || c.is_whitespace())
}

fn term_to_token(term: &str) -> Cow<'_, str> {
    TOKEN_STRIP.replace_all(term, "")
}
fn filter_terms<S, T>(pseudoterms: T) -> impl Iterator<Item = S>
where
    S: AsRef<str>,
    T: Iterator<Item = S>,
{
    pseudoterms.filter(|t| TERM_RE.is_match(t.as_ref()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_split_string() {
        let input = "the quick brown";
        let expected = vec!["the", "quick", "brown"];
        let tokens: Vec<_> = input.words().collect();
        assert_eq!(tokens, expected);
    }

    #[test]
    fn test_term_to_token() {
        let input = "the.";
        let expected = "the";
        assert_eq!(term_to_token(input), expected);

        let input = "quick";
        let expected = "quick";
        assert_eq!(term_to_token(input), expected);

        let input = "brown🦊";
        let expected = "brown";
        assert_eq!(term_to_token(input), expected);
    }

    #[test]
    fn test_filter_terms() {
        let input = vec!["", "the", " ", "quick", " ", "brown", ""];
        let expected = vec!["the", "quick", "brown"];
        let filtered: Vec<_> = filter_terms(input.into_iter()).collect();
        assert_eq!(filtered, expected);
    }

    #[test]
    fn test_string_to_tokens() {
        let result = "The. quick-Brown, fox 🦊".search_tokens();
        let expected = vec!["the", "quick", "brown", "fox"];
        assert_eq!(result, expected);
    }

    #[test]
    fn test_string_to_tokens_with_non_words() {
        let result = "  The.   quick-Brown, @  fox  🦊   ".search_tokens();
        let expected = vec!["the", "quick", "brown", "fox"];
        assert_eq!(result, expected);
    }

    #[test]
    fn test_datachunks_to_tokens_with_extra_whitespaces() {
        let tokens = ContentState::from(vec![
            DataChunk::text("I can see some"),
            DataChunk::edge("dog_id"), // lozenge without whitespaces around
            DataChunk::text("eating a "),
            DataChunk::edge("hot_dog_id"), // lozenge with whitespaces around
            DataChunk::text(" now"),
        ])
        .search_tokens();
        let expected = vec!["i", "can", "see", "some", "eating", "a", "now"];
        assert_eq!(tokens, expected);
    }
}
