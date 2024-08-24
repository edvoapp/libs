#[allow(clippy::module_inception)]
pub mod radial_nav;

mod button;
mod tooltip;

use crate::svg::Svg;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn get_search_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/search.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_note_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/note.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_sticky_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/sticky.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_browser_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/browser.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_portal_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/portal.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_center_thingy() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/radial.svg"),
        (48, 48),
    )
}

#[wasm_bindgen]
pub fn get_default_tooltip_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/default_tooltip.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_search_tooltip_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/search_tooltip.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_note_tooltip_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/note_tooltip.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_sticky_tooltip_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/sticky_tooltip.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_browser_tooltip_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/browser_tooltip.svg"),
        (48, 48),
    )
}
#[wasm_bindgen]
pub fn get_portal_tooltip_icon() -> Svg {
    Svg::new(
        include_bytes!("../../../../../assets/icons/portal_tooltip.svg"),
        (48, 48),
    )
}
