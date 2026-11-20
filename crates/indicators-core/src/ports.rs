//! Ports implemented by adapters. Traits are object-safe and `Send + Sync` so
//! the Tauri state can share them across blocking worker threads.

use std::path::Path;

use crate::domain::{Catalog, CoreError, DatasetInfo, Observation, ReleaseInfo, SavedView};

/// Read-only access to an open snapshot.
pub trait SnapshotReader: Send + Sync {
    fn info(&self) -> Result<DatasetInfo, CoreError>;
    fn catalog(&self) -> Result<Catalog, CoreError>;
    fn observations(
        &self,
        indicator_codes: &[String],
        iso3s: &[String],
    ) -> Result<Vec<Observation>, CoreError>;
}

/// Validates and opens a snapshot file, returning a reader for the new dataset.
pub trait SnapshotOpener: Send + Sync {
    fn open(&self, path: &Path) -> Result<Box<dyn SnapshotReader>, CoreError>;
}

/// Persistence for saved views and settings.
pub trait UserStore: Send + Sync {
    fn list_views(&self) -> Result<Vec<SavedView>, CoreError>;
    fn get_view(&self, id: &str) -> Result<Option<SavedView>, CoreError>;
    fn insert_view(&self, view: &SavedView) -> Result<(), CoreError>;
    fn update_view(&self, view: &SavedView) -> Result<(), CoreError>;
    fn delete_view(&self, id: &str) -> Result<bool, CoreError>;
    fn count_views(&self) -> Result<usize, CoreError>;
    fn get_setting(&self, key: &str) -> Result<Option<String>, CoreError>;
    fn set_setting(&self, key: &str, value: &str) -> Result<(), CoreError>;
}

/// Writes export bytes to the filesystem.
pub trait ExportWriter: Send + Sync {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<(), CoreError>;
}

/// Minimal HTTP GET abstraction so the release feed is testable with fakes.
pub trait HttpGet: Send + Sync {
    fn get(&self, url: &str) -> Result<String, CoreError>;
}

/// Fetches the latest published release metadata.
pub trait ReleaseFeed: Send + Sync {
    fn latest(&self) -> Result<ReleaseInfo, CoreError>;
}

/// Wall-clock abstraction for deterministic tests.
pub trait Clock: Send + Sync {
    fn now_unix(&self) -> i64;
}

/// Id generation abstraction for deterministic tests.
pub trait IdGenerator: Send + Sync {
    fn new_id(&self) -> String;
}
