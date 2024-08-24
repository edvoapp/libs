#[derive(Debug, Clone, Default)]
pub enum LoadState<T> {
    #[default]
    Loading,
    None,
    Loaded(T),
}

impl<T> LoadState<T> {
    pub fn loaded(&self) -> Option<&T> {
        match self {
            LoadState::Loaded(val) => Some(val),
            _ => None,
        }
    }

    pub fn as_ref(&self) -> LoadState<&T> {
        match self {
            LoadState::Loading => todo!(),
            LoadState::None => todo!(),
            LoadState::Loaded(value) => LoadState::Loaded(value),
        }
    }
}
