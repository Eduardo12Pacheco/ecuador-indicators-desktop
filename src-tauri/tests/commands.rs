//! IPC command tests over the real mini snapshot and a real SQLite user store.
//!
//! The app is built with `tauri::test::mock_builder`, so these tests exercise
//! exactly the command layer the React UI calls, without opening a window.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use ecuador_indicators_lib::commands::AppInfo;
use ecuador_indicators_lib::config::AppConfig;
use ecuador_indicators_lib::state::AppState;
use indicators_core::adapters::fs_export::FsExportWriter;
use indicators_core::adapters::github_release_feed::GithubReleaseFeed;
use indicators_core::adapters::http::UreqHttpGet;
use indicators_core::adapters::sqlite_snapshot::SqliteSnapshotReader;
use indicators_core::adapters::sqlite_user_store::SqliteUserStore;
use indicators_core::adapters::system::{SystemClock, UuidGenerator};
use indicators_core::application::{
    DatasetService, ExportService, SettingsService, UpdateService, ViewService,
};
use indicators_core::domain::{DatasetInfo, LangPref, Observation, SavedView, Settings, ThemePref};
use indicators_core::ports::SnapshotReader;
use serde::de::DeserializeOwned;
use serde_json::{Value, json};
use tauri::test::{INVOKE_KEY, MockRuntime, mock_builder, mock_context, noop_assets};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewWindow, WebviewWindowBuilder};

fn fixture() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../crates/indicators-core/tests/fixtures/mini.snapshot.sqlite")
}

fn config(home: &Path) -> AppConfig {
    AppConfig {
        home_dir: home.to_path_buf(),
        log_dir: home.join("logs"),
        snapshot_override: None,
        update_url: "http://127.0.0.1:9/releases/latest".to_string(),
        log_level: "error".to_string(),
    }
}

fn state(home: &Path) -> AppState {
    let reader: Arc<dyn SnapshotReader> =
        Arc::new(SqliteSnapshotReader::open(&fixture()).expect("mini fixture must open"));
    let dataset = Arc::new(DatasetService::new(reader));
    let store = Arc::new(SqliteUserStore::open(&home.join("user.db")).unwrap());
    let clock = Arc::new(SystemClock);
    let settings = Arc::new(SettingsService::new(store.clone()));
    let views = Arc::new(ViewService::new(
        store,
        clock.clone(),
        Arc::new(UuidGenerator),
    ));
    let export = Arc::new(ExportService::new(Arc::new(FsExportWriter)));
    let http = Arc::new(UreqHttpGet::new(
        "ecuador-indicators/test",
        Duration::from_millis(50),
    ));
    let feed = Arc::new(GithubReleaseFeed::new(
        http,
        "http://127.0.0.1:9/releases/latest",
    ));
    let updates = Arc::new(UpdateService::new(feed, settings.clone(), clock));
    AppState::new(config(home), dataset, views, settings, export, updates)
}

fn app(home: &Path) -> App<MockRuntime> {
    ecuador_indicators_lib::configure_builder(mock_builder())
        .manage(state(home))
        .build(mock_context(noop_assets()))
        .expect("mock app must build")
}

fn window(app: &App<MockRuntime>) -> WebviewWindow<MockRuntime> {
    WebviewWindowBuilder::new(app, "main", Default::default())
        .build()
        .expect("mock window must build")
}

fn invoke<T: DeserializeOwned>(
    window: &WebviewWindow<MockRuntime>,
    command: &str,
    body: Value,
) -> Result<T, Value> {
    let response = tauri::test::get_ipc_response(
        window,
        InvokeRequest {
            cmd: command.to_string(),
            callback: tauri::ipc::CallbackFn(0),
            error: tauri::ipc::CallbackFn(1),
            url: if cfg!(any(windows, target_os = "android")) {
                "http://tauri.localhost"
            } else {
                "tauri://localhost"
            }
            .parse()
            .unwrap(),
            body: tauri::ipc::InvokeBody::Json(body),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_string(),
        },
    );
    response.map(|body| body.deserialize::<T>().expect("response must decode"))
}

#[test]
fn app_info_exposes_version_platform_and_directories() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);

    let info: AppInfo = invoke(&window, "app_info", json!({})).unwrap();

    assert_eq!(info.version, env!("CARGO_PKG_VERSION"));
    assert_eq!(info.platform, std::env::consts::OS);
    assert_eq!(PathBuf::from(info.data_dir), directory.path().to_path_buf());
    assert_eq!(PathBuf::from(info.log_dir), directory.path().join("logs"));
}

#[test]
fn dataset_info_returns_the_mini_snapshot_counts() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);

    let info: DatasetInfo = invoke(&window, "dataset_info", json!({})).unwrap();

    assert_eq!(info.schema_version, 1);
    assert_eq!(info.origin, "worldbank");
    assert_eq!(info.counts.topics, 3);
    assert_eq!(info.counts.geographies, 5);
    assert_eq!(info.counts.indicators, 6);
    assert_eq!(info.counts.observations, 1_524);
}

#[test]
fn dataset_catalog_includes_spanish_names() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);

    let catalog: indicators_core::domain::Catalog =
        invoke(&window, "dataset_catalog", json!({})).unwrap();

    let gdp = catalog
        .indicators
        .iter()
        .find(|indicator| indicator.code == "NY.GDP.MKTP.CD")
        .expect("GDP must be in the catalog");
    assert_eq!(gdp.name_es, "PIB (US$ a precios actuales)");
    assert!(
        catalog
            .geographies
            .iter()
            .any(|geography| geography.name_es == "Ecuador")
    );
}

#[test]
fn dataset_observations_filters_by_code_and_geography() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);

    let observations: Vec<Observation> = invoke(
        &window,
        "dataset_observations",
        json!({ "codes": ["NY.GDP.MKTP.CD"], "iso3s": ["ECU"] }),
    )
    .unwrap();

    assert_eq!(observations.len(), 66);
    assert!(
        observations
            .iter()
            .all(|observation| observation.indicator_code == "NY.GDP.MKTP.CD"
                && observation.iso3 == "ECU")
    );
    assert!(
        observations
            .windows(2)
            .all(|pair| pair[0].year < pair[1].year)
    );
}

#[test]
fn views_are_created_listed_updated_and_deleted_through_ipc() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);

    let created: SavedView = invoke(
        &window,
        "views_create",
        json!({
            "view": {
                "name": "  Ecuador ranking  ",
                "spec": { "kind": "ranking", "indicator": "NY.GDP.MKTP.CD", "year": 2024 }
            }
        }),
    )
    .unwrap();
    assert_eq!(created.name, "Ecuador ranking");
    assert!(created.created_at > 0);

    let listed: Vec<SavedView> = invoke(&window, "views_list", json!({})).unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);

    let updated: SavedView = invoke(
        &window,
        "views_update",
        json!({
            "id": created.id,
            "view": {
                "name": "Renamed",
                "spec": {
                    "kind": "explore",
                    "indicator": "NY.GDP.MKTP.CD",
                    "geographies": ["ECU", "COL"],
                    "from": 2000,
                    "to": 2024,
                    "transform": "level",
                    "base_year": null,
                    "chart": "line"
                }
            }
        }),
    )
    .unwrap();
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.name, "Renamed");
    assert_eq!(updated.created_at, created.created_at);

    invoke::<()>(&window, "views_delete", json!({ "id": created.id })).unwrap();
    let listed: Vec<SavedView> = invoke(&window, "views_list", json!({})).unwrap();
    assert!(listed.is_empty());
}

#[test]
fn settings_defaults_and_round_trip_through_ipc() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);

    let defaults: Settings = invoke(&window, "settings_get", json!({})).unwrap();
    assert_eq!(defaults.theme, ThemePref::System);
    assert_eq!(defaults.language, LangPref::System);
    assert!(!defaults.update_check_enabled);
    assert!(defaults.last_update_check.is_none());
    assert!(defaults.custom_snapshot_path.is_none());

    invoke::<()>(
        &window,
        "settings_set",
        json!({
            "settings": {
                "theme": "dark",
                "language": "es",
                "update_check_enabled": true,
                "last_update_check": 1_700_000_000,
                "custom_snapshot_path": null
            }
        }),
    )
    .unwrap();

    let saved: Settings = invoke(&window, "settings_get", json!({})).unwrap();
    assert_eq!(saved.theme, ThemePref::Dark);
    assert_eq!(saved.language, LangPref::Es);
    assert!(saved.update_check_enabled);
    assert_eq!(saved.last_update_check, Some(1_700_000_000));
}

#[test]
fn export_save_rejects_a_non_csv_or_png_destination() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);
    let destination = directory.path().join("payload.exe");

    let error = invoke::<()>(
        &window,
        "export_save",
        json!({ "path": destination, "content": [1, 2, 3] }),
    )
    .unwrap_err();

    assert_eq!(error["code"], "EXPORT_REJECTED");
    assert!(!destination.exists());
}

#[test]
fn export_save_writes_csv_content_atomically() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);
    let destination = directory.path().join("export.csv");

    let saved: String = invoke(
        &window,
        "export_save",
        json!({ "path": destination, "content": [104, 105] }),
    )
    .unwrap();

    assert_eq!(saved, destination.to_string_lossy());
    assert_eq!(std::fs::read(&destination).unwrap(), b"hi");
    let leftovers: Vec<_> = std::fs::read_dir(directory.path())
        .unwrap()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_name().to_string_lossy().contains(".tmp-"))
        .collect();
    assert!(leftovers.is_empty(), "temporary files must be renamed");
}

#[test]
fn dataset_open_snapshot_rejects_a_corrupt_file_and_keeps_the_active_dataset() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);
    let corrupt = directory.path().join("corrupt.sqlite");
    std::fs::write(&corrupt, b"not a snapshot").unwrap();

    let error = invoke::<DatasetInfo>(&window, "dataset_open_snapshot", json!({ "path": corrupt }))
        .unwrap_err();

    assert_eq!(error["code"], "SNAPSHOT_INVALID");

    let info: DatasetInfo = invoke(&window, "dataset_info", json!({})).unwrap();
    assert_eq!(info.counts.indicators, 6);
    assert_eq!(info.counts.observations, 1_524);
}

#[test]
fn dataset_open_snapshot_swaps_to_a_valid_custom_file_and_reset_restores_the_bundled_one() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);
    let custom = directory.path().join("custom.sqlite");
    std::fs::copy(fixture(), &custom).unwrap();

    let opened: DatasetInfo =
        invoke(&window, "dataset_open_snapshot", json!({ "path": custom })).unwrap();
    assert_eq!(opened.counts.indicators, 6);

    let settings: Settings = invoke(&window, "settings_get", json!({})).unwrap();
    assert_eq!(
        settings.custom_snapshot_path,
        Some(custom.to_string_lossy().to_string())
    );

    let reset: DatasetInfo = invoke(&window, "dataset_reset_snapshot", json!({})).unwrap();
    assert_eq!(reset.counts.observations, 1_524);
    let settings: Settings = invoke(&window, "settings_get", json!({})).unwrap();
    assert!(settings.custom_snapshot_path.is_none());
}

#[test]
fn updates_check_returns_disabled_when_the_setting_is_off() {
    let directory = tempfile::tempdir().unwrap();
    let app = app(directory.path());
    let window = window(&app);

    let status: indicators_core::domain::UpdateStatus =
        invoke(&window, "updates_check", json!({ "force": false })).unwrap();

    assert_eq!(
        status,
        indicators_core::domain::UpdateStatus::disabled(env!("CARGO_PKG_VERSION"))
    );
}
