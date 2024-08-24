use std::sync::Arc;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContentType {
    TextPlain,
    TextXUri,
    Other(Arc<str>),
}

impl ContentType {
    pub fn parse(content_type: &str) -> ContentType {
        match content_type {
            "text/plain" => ContentType::TextPlain,
            "text/x-uri" => ContentType::TextXUri,
            s => ContentType::Other(Arc::from(s)),
        }
    }
}
