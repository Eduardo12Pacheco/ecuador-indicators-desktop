//! Application state shared by every IPC command (D24).

use std::sync::{Arc, RwLock};

use indicators_core::application::{
    DatasetService, ExportService, SettingsService, UpdateService, ViewService,
};
use indicators_core::domain::CoreError;

use crate::config::AppConfig;

/// Services and configuration managed by Tauri.
///
/// The dataset is held behind an `RwLock<Arc<DatasetService>>` so a future
/// custom-snapshot swap can replace the whole service atomically; today
/// `DatasetService` already swaps its active reader under its own lock, and a
/// failed open leaves both the reader and this `Arc` untouched.
pub struct AppState {
    config: AppConfig,
    dataset: RwLock<Arc<DatasetService>>,
    views: Arc<ViewService>,
    settings: Arc<SettingsService>,
    export: Arc<ExportService>,
    updates: Arc<UpdateService>,
}

impl AppState {
    #[must_use]
    pub fn new(
        config: AppConfig,
        dataset: Arc<DatasetService>,
        views: Arc<ViewService>,
        settings: Arc<SettingsService>,
        export: Arc<ExportService>,
        updates: Arc<UpdateService>,
    ) -> Self {
        Self {
            config,
            dataset: RwLock::new(dataset),
            views,
            settings,
            export,
            updates,
        }
    }

    #[must_use]
    pub fn config(&self) -> &AppConfig {
        &self.config
    }

    /// # Errors
    /// Returns `INTERNAL` when the dataset lock is poisoned.
    pub fn dataset(&self) -> Result<Arc<DatasetService>, CoreError> {
        self.dataset
            .read()
            .map(|guard| Arc::clone(&guard))
            .map_err(|_| CoreError::internal("dataset lock poisoned"))
    }

    #[must_use]
    pub fn views(&self) -> Arc<ViewService> {
        Arc::clone(&self.views)
    }

    #[must_use]
    pub fn settings(&self) -> Arc<SettingsService> {
        Arc::clone(&self.settings)
    }

    #[must_use]
    pub fn export(&self) -> Arc<ExportService> {
        Arc::clone(&self.export)
    }

    #[must_use]
    pub fn updates(&self) -> Arc<UpdateService> {
        Arc::clone(&self.updates)
    }
}
