//! The fourteen IPC commands (D24).
//!
//! Every command is `async` and delegates blocking SQLite/filesystem work to
//! `tauri::async_runtime::spawn_blocking`, so the webview thread is never held
//! by I/O. Failures are returned as [`ErrorDto`] with the stable core code.

use std::path::PathBuf;

use indicators_core::adapters::sqlite_snapshot::SqliteSnapshotOpener;
use indicators_core::domain::{
    Catalog, CoreError, DatasetInfo, ErrorDto, NewView, Observation, SavedView, Settings,
    UpdateStatus,
};
use serde::{Deserialize, Serialize};
use tauri::State;
use ts_rs::TS;

use crate::error;
use crate::state::AppState;

/// Read-only application metadata shown by the About and Settings pages.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AppInfo {
    pub version: String,
    pub platform: String,
    pub data_dir: String,
    pub log_dir: String,
}

async fn blocking<T, F>(job: F) -> Result<T, ErrorDto>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, CoreError> + Send + 'static,
{
    match tauri::async_runtime::spawn_blocking(job).await {
        Ok(result) => result.map_err(|error| error::to_dto(&error)),
        Err(join_error) => Err(error::internal(format!(
            "blocking task failed: {join_error}"
        ))),
    }
}

/// Returns version, platform and the resolved data/log directories.
#[tauri::command]
pub async fn app_info(state: State<'_, AppState>) -> Result<AppInfo, ErrorDto> {
    let config = state.config().clone();
    blocking(move || {
        Ok(AppInfo {
            version: env!("CARGO_PKG_VERSION").to_string(),
            platform: std::env::consts::OS.to_string(),
            data_dir: config.home_dir.to_string_lossy().to_string(),
            log_dir: config.log_dir.to_string_lossy().to_string(),
        })
    })
    .await
}

/// Returns provenance and counts for the active snapshot.
#[tauri::command]
pub async fn dataset_info(state: State<'_, AppState>) -> Result<DatasetInfo, ErrorDto> {
    let dataset = state.dataset().map_err(|error| error::to_dto(&error))?;
    blocking(move || dataset.info()).await
}

/// Returns the complete catalog in curated order.
#[tauri::command]
pub async fn dataset_catalog(state: State<'_, AppState>) -> Result<Catalog, ErrorDto> {
    let dataset = state.dataset().map_err(|error| error::to_dto(&error))?;
    blocking(move || dataset.catalog()).await
}

/// Returns observations for the requested indicator codes and geographies.
#[tauri::command]
pub async fn dataset_observations(
    state: State<'_, AppState>,
    codes: Vec<String>,
    iso3s: Vec<String>,
) -> Result<Vec<Observation>, ErrorDto> {
    let dataset = state.dataset().map_err(|error| error::to_dto(&error))?;
    blocking(move || dataset.observations(&codes, &iso3s)).await
}

/// Validates and opens a pipeline-produced snapshot, remembering its path.
#[tauri::command]
pub async fn dataset_open_snapshot(
    state: State<'_, AppState>,
    path: String,
) -> Result<DatasetInfo, ErrorDto> {
    let dataset = state.dataset().map_err(|error| error::to_dto(&error))?;
    let settings = state.settings();
    let path = PathBuf::from(path);
    blocking(move || {
        let info = dataset.open_custom(&SqliteSnapshotOpener, &path)?;
        let mut document = settings.get()?;
        document.custom_snapshot_path = Some(path.to_string_lossy().to_string());
        settings.set(&document)?;
        Ok(info)
    })
    .await
}

/// Restores the bundled snapshot and clears the remembered custom path.
#[tauri::command]
pub async fn dataset_reset_snapshot(state: State<'_, AppState>) -> Result<DatasetInfo, ErrorDto> {
    let dataset = state.dataset().map_err(|error| error::to_dto(&error))?;
    let settings = state.settings();
    blocking(move || {
        let info = dataset.reset()?;
        let mut document = settings.get()?;
        document.custom_snapshot_path = None;
        settings.set(&document)?;
        Ok(info)
    })
    .await
}

/// Lists saved views, most recently updated first.
#[tauri::command]
pub async fn views_list(state: State<'_, AppState>) -> Result<Vec<SavedView>, ErrorDto> {
    let views = state.views();
    blocking(move || views.list_views()).await
}

/// Creates a saved view after name, spec and limit validation.
#[tauri::command]
pub async fn views_create(
    state: State<'_, AppState>,
    view: NewView,
) -> Result<SavedView, ErrorDto> {
    let views = state.views();
    blocking(move || views.create_view(view)).await
}

/// Updates an existing saved view.
#[tauri::command]
pub async fn views_update(
    state: State<'_, AppState>,
    id: String,
    view: NewView,
) -> Result<SavedView, ErrorDto> {
    let views = state.views();
    blocking(move || views.update_view(&id, view)).await
}

/// Deletes a saved view; a missing id is `VIEW_NOT_FOUND`.
#[tauri::command]
pub async fn views_delete(state: State<'_, AppState>, id: String) -> Result<(), ErrorDto> {
    let views = state.views();
    blocking(move || views.delete_view(&id)).await
}

/// Returns the complete typed settings document.
#[tauri::command]
pub async fn settings_get(state: State<'_, AppState>) -> Result<Settings, ErrorDto> {
    let settings = state.settings();
    blocking(move || settings.get()).await
}

/// Persists the complete typed settings document.
#[tauri::command]
pub async fn settings_set(state: State<'_, AppState>, settings: Settings) -> Result<(), ErrorDto> {
    let service = state.settings();
    blocking(move || service.set(&settings)).await
}

/// Writes pre-serialized CSV or PNG bytes to a validated destination.
#[tauri::command]
pub async fn export_save(
    state: State<'_, AppState>,
    path: String,
    content: Vec<u8>,
) -> Result<String, ErrorDto> {
    let export = state.export();
    let destination = PathBuf::from(&path);
    blocking(move || {
        export.save(&destination, &content)?;
        Ok(path)
    })
    .await
}

/// Runs a notify-only update check; `force` is the "Check now" button.
#[tauri::command]
pub async fn updates_check(
    state: State<'_, AppState>,
    force: bool,
) -> Result<UpdateStatus, ErrorDto> {
    let updates = state.updates();
    blocking(move || updates.check(env!("CARGO_PKG_VERSION"), force)).await
}
