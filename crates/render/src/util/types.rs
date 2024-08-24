use std::str::FromStr;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum ObjectKind {
    Arrow,
    DepthMask,
    Frame,
    RadialNav,
    SelectionBox,
    Svg,
    Unknown,
}

impl Default for ObjectKind {
    fn default() -> Self {
        Self::Unknown
    }
}

impl FromStr for ObjectKind {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "arrow" => Ok(Self::Arrow),
            "depth-mask" => Ok(Self::DepthMask),
            "radial-nav" => Ok(Self::RadialNav),
            "svg" => Ok(Self::Svg),
            _ => Err("the given shader object type '{}' does not exist".to_string()),
        }
    }
}
