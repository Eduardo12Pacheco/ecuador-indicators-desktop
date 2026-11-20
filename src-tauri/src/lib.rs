#![forbid(unsafe_code)]

//! Tauri composition root for Ecuador Indicators (T5).
//!
//! `--self-check` is handled before any Tauri runtime starts, so it works on a
//! headless machine and never creates a window. Normal launches build the
//! services from the typed configuration, register the four plugins, create the
//! main window in `setup` (the config declares no static windows) and expose the
//! fourteen IPC commands from D24.

pub mod cli;
pub mod commands;
pub mod config;
pub mod error;
pub mod logging;
pub mod self_check;
pub mod state;

use std::sync::Arc;
use std::time::Duration;

use indicators_core::adapters::fs_export::FsExportWriter;
use indicators_core::adapters::github_release_feed::GithubReleaseFeed;
use indicators_core::adapters::http::UreqHttpGet;
use indicators_core::adapters::sqlite_snapshot::{SqliteSnapshotOpener, SqliteSnapshotReader};
use indicators_core::adapters::sqlite_user_store::SqliteUserStore;
use indicators_core::adapters::system::{SystemClock, UuidGenerator};
use indicators_core::application::{
    DatasetService, ExportService, SettingsService, UpdateService, ViewService,
};
use indicators_core::domain::CoreError;
use indicators_core::ports::{HttpGet, SnapshotReader};
use tauri::Manager;

use crate::config::AppConfig;
use crate::state::AppState;

/// Window title (D27).
pub const WINDOW_TITLE: &str = "Ecuador Indicators";
/// Default window size (S16).
pub const WINDOW_WIDTH: f64 = 1280.0;
/// Default window height (S16).
pub const WINDOW_HEIGHT: f64 = 800.0;
/// Minimum window width (S16).
pub const MIN_WINDOW_WIDTH: f64 = 960.0;
/// Minimum window height (S16).
pub const MIN_WINDOW_HEIGHT: f64 = 640.0;

/// Registers the fourteen IPC commands on any Tauri runtime.
///
/// Kept separate from plugin wiring so `tauri::test::mock_builder` can exercise
/// the exact command surface without desktop plugins.
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

fn bootstrap(config: &AppConfig) -> Result<AppState, CoreError> {
    std::fs::create_dir_all(&config.home_dir).map_err(|error| {
        CoreError::storage(format!(
            "cannot create the app data directory {}: {error}",
            config.home_dir.display()
        ))
    })?;

    let snapshot_path = config.resolve_snapshot();
    let reader: Arc<dyn SnapshotReader> = Arc::new(SqliteSnapshotReader::open(&snapshot_path)?);
    let dataset = Arc::new(DatasetService::new(reader));
    let store = Arc::new(SqliteUserStore::open(&config.home_dir.join("user.db"))?);
    let settings = Arc::new(SettingsService::new(store.clone()));
    let clock = Arc::new(SystemClock);

    if let Ok(document) = settings.get()
        && let Some(custom) = document.custom_snapshot_path.as_deref()
    {
        match dataset.open_custom(&SqliteSnapshotOpener, std::path::Path::new(custom)) {
            Ok(info) => tracing::info!(
                path = custom,
                indicators = info.counts.indicators,
                "restored the remembered custom snapshot"
            ),
            Err(error) => tracing::warn!(
                path = custom,
                %error,
                "the remembered custom snapshot is no longer valid; using the bundled one"
            ),
        }
    }

    let views = Arc::new(ViewService::new(
        store,
        clock.clone(),
        Arc::new(UuidGenerator),
    ));
    let export = Arc::new(ExportService::new(Arc::new(FsExportWriter)));
    let http: Arc<dyn HttpGet> = Arc::new(UreqHttpGet::new(
        format!("ecuador-indicators/{}", env!("CARGO_PKG_VERSION")),
        Duration::from_secs(10),
    ));
    let feed = Arc::new(GithubReleaseFeed::new(http, config.update_url.clone()));
    let updates = Arc::new(UpdateService::new(feed, settings.clone(), clock));

    Ok(AppState::new(
        config.clone(),
        dataset,
        views,
        settings,
        export,
        updates,
    ))
}

fn create_main_window<R: tauri::Runtime>(app: &mut tauri::App<R>) -> tauri::Result<()> {
    tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::App("index.html".into()))
        .title(WINDOW_TITLE)
        .inner_size(WINDOW_WIDTH, WINDOW_HEIGHT)
        .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
        .resizable(true)
        .center()
        .build()?;
    Ok(())
}

fn run_app() -> Result<(), String> {
    let config = AppConfig::from_env();
    let _guard = logging::init(&config)?;
    let state = bootstrap(&config).map_err(|error| error.to_string())?;
    tracing::info!(
        version = env!("CARGO_PKG_VERSION"),
        data_dir = %config.home_dir.display(),
        "starting Ecuador Indicators"
    );

    let context = tauri::generate_context!();
    let builder = tauri::Builder::default()
        // The single-instance plugin must be registered before every other plugin.
        .plugin(tauri_plugin_single_instance::init(
            |app, _arguments, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            },
        ))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .setup(|app| {
            create_main_window(app)?;
            Ok(())
        });
    let app = configure_builder(builder)
        .build(context)
        .map_err(|error| error.to_string())?;
    app.run(|_, _| {});
    Ok(())
}

/// Starts the desktop application or performs the headless self-check.
pub fn run() {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match cli::parse_args(arguments) {
        Ok(cli::Cli::SelfCheck { out }) => {
            let config = AppConfig::from_env();
            let _guard = logging::init(&config).ok();
            let ok = self_check::run_and_write(&config, &out);
            std::process::exit(if ok { 0 } else { 1 });
        }
        Ok(cli::Cli::Run) => {
            if let Err(error) = run_app() {
                eprintln!("failed to start Ecuador Indicators: {error}");
                std::process::exit(1);
            }
        }
        Err(error) => {
            eprintln!("{error}");
            eprintln!("{}", cli::USAGE);
            std::process::exit(2);
        }
    }
}
