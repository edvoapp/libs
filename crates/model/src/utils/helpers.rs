use unicode_segmentation::UnicodeSegmentation;
use wasm_bindgen::prelude::*;

/// Calculates the total number of UTF-16 units in a string.
///
/// This function computes the sum of UTF-16 code units required to represent
/// each grapheme cluster in the provided string. It's particularly useful for
/// determining the size of a string if it were encoded in UTF-16 format.
///
/// Each Unicode scalar value within a grapheme cluster is converted to its
/// respective UTF-16 code units, and their counts are summed up.
///
/// # Examples
///
/// ```
/// use edvo_model::utils::helpers::len_utf16_str;
///
/// assert_eq!(len_utf16_str("\n"), 1);
///
/// assert_eq!(len_utf16_str("蟹"), 1);
/// assert_eq!(len_utf16_str("hi 蟹"), 4);
///
/// assert_eq!(len_utf16_str("💜"), 2);
/// assert_eq!(len_utf16_str("🦀"), 2);
/// assert_eq!(len_utf16_str("👨‍🎨"), 5);
/// assert_eq!(len_utf16_str("👨‍🎨 💜 🦀"), 11);
/// ```
///
#[wasm_bindgen]
pub fn len_utf16_str(string: &str) -> usize {
    let graphemes = UnicodeSegmentation::graphemes(string, true);
    graphemes.fold(0, |acc, g| acc + len_utf16_gr(g))
}

#[wasm_bindgen]
pub fn len_utf16_gr(grapheme: &str) -> usize {
    grapheme.chars().fold(0, |acc, c| acc + c.len_utf16())
}
