#![forbid(unsafe_code)]

//! Tauri composition root for Ecuador Indicators.
//!
//! T5 wires the command surface here; the self-check and window setup land in
//! the following commits.

pub mod cli;
pub mod commands;
pub mod config;
pub mod error;
pub mod logging;
pub mod state;

/// Registers the fourteen IPC commands on any Tauri runtime.
pub fn configure_builder<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        commands::app_info,
        commands::dataset_info,
        commands::dataset_catalog,
        commands::dataset_observations,
        commands::dataset_open_snapshot,
        commands::dataset_reset_snapshot,
        commands::views_list,
        commands::views_create,
        commands::views_update,
        commands::views_delete,
        commands::settings_get,
        commands::settings_set,
        commands::export_save,
        commands::updates_check,
    ])
}

/// Starts the desktop application.
pub fn run() {
    // Replaced by the full composition root later in T5.
}
