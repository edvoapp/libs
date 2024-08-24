use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
#[derive(Debug, Clone, PartialEq, Default)]
pub struct ContentRangeOffsets {
    start: u32,
    end: u32,
}

#[wasm_bindgen]
impl ContentRangeOffsets {
    pub fn new(start: u32, end: u32) -> Self {
        Self { start, end }
    }

    pub fn collapsed(offset: u32) -> Self {
        Self::new(offset, offset)
    }

    #[wasm_bindgen(getter)]
    pub fn start(&self) -> u32 {
        self.start
    }

    #[wasm_bindgen(getter)]
    pub fn end(&self) -> u32 {
        self.end
    }

    #[wasm_bindgen(getter)]
    pub fn min(&self) -> u32 {
        self.start.min(self.end)
    }

    #[wasm_bindgen(getter)]
    pub fn max(&self) -> u32 {
        self.start.max(self.end)
    }

    #[wasm_bindgen(getter)]
    pub fn length(&self) -> u32 {
        self.start.abs_diff(self.end)
    }

    #[wasm_bindgen(getter)]
    pub fn is_collapsed(&self) -> bool {
        self.start == self.end
    }

    /// (noun) indicates whether this ContentRangeOffsets object is reversed
    #[wasm_bindgen(getter)]
    pub fn reversed(&self) -> bool {
        self.start > self.end
    }
}

impl PartialEq<(u32, u32)> for ContentRangeOffsets {
    fn eq(&self, other: &(u32, u32)) -> bool {
        self.start == other.0 && self.end == other.1
    }
}
