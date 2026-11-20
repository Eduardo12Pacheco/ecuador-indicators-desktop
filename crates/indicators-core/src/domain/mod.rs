//! Pure domain types: no I/O, no SQLite, no HTTP, no Tauri.

mod error;
mod model;
mod settings;
mod update;
mod view;

pub use error::{CoreError, ErrorDto};
pub use model::{
    Catalog, DatasetCounts, DatasetInfo, Geography, HigherIs, Indicator, Observation, Topic,
    ValueKind,
};
pub use settings::{LangPref, Settings, ThemePref};
pub use update::{ReleaseInfo, UpdateStatus, is_newer, parse_version};
pub use view::{ChartKind, NewView, SavedView, Transform, ViewSpec};
