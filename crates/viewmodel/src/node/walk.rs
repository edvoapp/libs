use crate::TSNodeWrapper;

pub trait WalkableNode: Sized + Clone {
    fn previous_sibling(&self) -> Option<Self>;
    fn next_sibling(&self) -> Option<Self>;
    fn length(&self) -> usize;
}

impl WalkableNode for TSNodeWrapper {
    fn previous_sibling(&self) -> Option<Self> {
        self.0.prevSiblingAny().map(TSNodeWrapper::new)
    }

    fn next_sibling(&self) -> Option<Self> {
        self.0.nextSiblingAny().map(TSNodeWrapper::new)
    }

    fn length(&self) -> usize {
        self.0.chunk_length()
    }
}
