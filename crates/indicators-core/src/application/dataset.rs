//! Dataset use cases: read the active snapshot and swap custom snapshots.

use std::path::Path;
use std::sync::{Arc, RwLock};

use crate::domain::{Catalog, CoreError, DatasetInfo, Observation};
use crate::ports::{SnapshotOpener, SnapshotReader};

/// Holds the active snapshot reader and swaps it atomically after validation.
///
/// The bundled reader is retained so `reset` can restore it without touching
/// the filesystem; a failed `open_custom` leaves the active dataset unchanged.
pub struct DatasetService {
    bundled: Arc<dyn SnapshotReader>,
    active: RwLock<Arc<dyn SnapshotReader>>,
}

impl DatasetService {
    #[must_use]
    pub fn new(bundled: Arc<dyn SnapshotReader>) -> Self {
        Self {
            active: RwLock::new(Arc::clone(&bundled)),
            bundled,
        }
    }

    fn active(&self) -> Result<Arc<dyn SnapshotReader>, CoreError> {
        self.active
            .read()
            .map(|guard| Arc::clone(&guard))
            .map_err(|_| CoreError::internal("dataset lock poisoned"))
    }

    fn replace(&self, reader: Arc<dyn SnapshotReader>) -> Result<(), CoreError> {
        let mut guard = self
            .active
            .write()
            .map_err(|_| CoreError::internal("dataset lock poisoned"))?;
        *guard = reader;
        Ok(())
    }

    /// # Errors
    /// Propagates snapshot read errors.
    pub fn info(&self) -> Result<DatasetInfo, CoreError> {
        self.active()?.info()
    }

    /// # Errors
    /// Propagates snapshot read errors.
    pub fn catalog(&self) -> Result<Catalog, CoreError> {
        self.active()?.catalog()
    }

    /// # Errors
    /// Propagates snapshot read errors.
    pub fn observations(
        &self,
        indicator_codes: &[String],
        iso3s: &[String],
    ) -> Result<Vec<Observation>, CoreError> {
        self.active()?.observations(indicator_codes, iso3s)
    }

    /// Validates `path` through the opener and only then swaps the dataset.
    ///
    /// # Errors
    /// Returns the opener's error (for example `SNAPSHOT_INVALID`) and keeps the
    /// previous dataset active.
    pub fn open_custom(
        &self,
        opener: &dyn SnapshotOpener,
        path: &Path,
    ) -> Result<DatasetInfo, CoreError> {
        let reader = opener.open(path)?;
        let info = reader.info()?;
        self.replace(Arc::from(reader))?;
        Ok(info)
    }

    /// Restores the bundled snapshot.
    ///
    /// # Errors
    /// Propagates snapshot read errors.
    pub fn reset(&self) -> Result<DatasetInfo, CoreError> {
        self.replace(Arc::clone(&self.bundled))?;
        self.info()
    }
}
