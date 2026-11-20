//! Service-level tests with in-memory fakes: every branch of the application
//! services is exercised here without touching SQLite or the network.

mod common;

use std::path::Path;
use std::sync::Arc;

use common::{
    FakeClock, FakeOpener, FakeReader, FakeReleaseFeed, MemoryUserStore, RecordingWriter,
    SeqIdGenerator, default_settings, explore_spec, ranking_spec, released, saved_view,
    trajectories_spec,
};
use indicators_core::application::{
    DatasetService, ExportService, SettingsService, UpdateService, ViewService,
};
use indicators_core::domain::{
    ChartKind, CoreError, NewView, Settings, ThemePref, Transform, UpdateStatus, ViewSpec,
};
use indicators_core::ports::{IdGenerator, UserStore};

fn user_store() -> (Arc<MemoryUserStore>, Arc<dyn UserStore>) {
    let concrete = Arc::new(MemoryUserStore::default());
    let port: Arc<dyn UserStore> = concrete.clone();
    (concrete, port)
}

fn view_service(store: &Arc<dyn UserStore>, clock: &Arc<FakeClock>) -> ViewService {
    let ids: Arc<dyn IdGenerator> = Arc::new(SeqIdGenerator::default());
    ViewService::new(store.clone(), clock.clone(), ids)
}

fn settings_service(store: &Arc<dyn UserStore>) -> SettingsService {
    SettingsService::new(store.clone())
}

#[test]
fn dataset_service_delegates_reads_to_the_active_reader() {
    let service = DatasetService::new(Arc::new(FakeReader::new()));

    assert_eq!(service.info().unwrap().counts.observations, 3);
    assert_eq!(service.catalog().unwrap().indicators.len(), 1);
    let observations = service
        .observations(&["NY.GDP.MKTP.CD".to_string()], &["ECU".to_string()])
        .unwrap();
    assert_eq!(observations.len(), 2);
    assert_eq!(observations[0].year, 2023);
}

#[test]
fn dataset_service_swaps_after_a_validated_custom_snapshot() {
    let service = DatasetService::new(Arc::new(FakeReader::new()));
    let mut custom = FakeReader::new();
    custom.info.dataset_version = "custom".to_string();
    custom.info.counts.observations = 42;

    let info = service
        .open_custom(&FakeOpener::ok(custom), Path::new("/tmp/custom.sqlite"))
        .unwrap();

    assert_eq!(info.dataset_version, "custom");
    assert_eq!(service.info().unwrap().dataset_version, "custom");
    assert_eq!(service.info().unwrap().counts.observations, 42);
}

#[test]
fn dataset_service_keeps_the_previous_dataset_when_open_fails() {
    let service = DatasetService::new(Arc::new(FakeReader::new()));
    let opener = FakeOpener::failing(CoreError::snapshot_invalid("bad header"));

    let error = service
        .open_custom(&opener, Path::new("/tmp/broken.sqlite"))
        .unwrap_err();

    assert_eq!(error.code(), "SNAPSHOT_INVALID");
    assert_eq!(service.info().unwrap().dataset_version, "2026-11-20");
}

#[test]
fn dataset_service_reset_restores_the_bundled_reader() {
    let service = DatasetService::new(Arc::new(FakeReader::new()));
    let mut custom = FakeReader::new();
    custom.info.dataset_version = "custom".to_string();
    service
        .open_custom(&FakeOpener::ok(custom), Path::new("/tmp/custom.sqlite"))
        .unwrap();

    let info = service.reset().unwrap();

    assert_eq!(info.dataset_version, "2026-11-20");
    assert_eq!(service.info().unwrap().dataset_version, "2026-11-20");
}

#[test]
fn view_service_creates_a_trimmed_view_with_timestamps() {
    let (_concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);

    let view = service
        .create_view(NewView {
            name: "  My view  ".to_string(),
            spec: explore_spec(),
        })
        .unwrap();

    assert_eq!(view.name, "My view");
    assert_eq!(view.created_at, 1_000);
    assert_eq!(view.updated_at, 1_000);
    assert_eq!(service.list_views().unwrap().len(), 1);
}

#[test]
fn view_service_get_reports_missing_views() {
    let (_concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);

    let error = service.get_view("nope").unwrap_err();

    assert_eq!(error.code(), "VIEW_NOT_FOUND");
}

#[test]
fn view_service_updates_keep_created_at_and_advance_updated_at() {
    let (_concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);
    let created = service
        .create_view(NewView {
            name: "First".to_string(),
            spec: explore_spec(),
        })
        .unwrap();

    clock.set(2_000);
    let updated = service
        .update_view(
            &created.id,
            NewView {
                name: "Renamed".to_string(),
                spec: ranking_spec(),
            },
        )
        .unwrap();

    assert_eq!(updated.id, created.id);
    assert_eq!(updated.name, "Renamed");
    assert_eq!(updated.created_at, 1_000);
    assert_eq!(updated.updated_at, 2_000);
    assert_eq!(service.get_view(&created.id).unwrap().spec, ranking_spec());
}

#[test]
fn view_service_update_reports_missing_views() {
    let (_concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);

    let error = service
        .update_view(
            "missing",
            NewView {
                name: "x".to_string(),
                spec: explore_spec(),
            },
        )
        .unwrap_err();

    assert_eq!(error.code(), "VIEW_NOT_FOUND");
}

#[test]
fn view_service_delete_reports_missing_views() {
    let (_concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);
    let created = service
        .create_view(NewView {
            name: "Gone".to_string(),
            spec: explore_spec(),
        })
        .unwrap();

    service.delete_view(&created.id).unwrap();
    let error = service.delete_view(&created.id).unwrap_err();

    assert_eq!(error.code(), "VIEW_NOT_FOUND");
    assert!(service.list_views().unwrap().is_empty());
}

#[test]
fn view_service_rejects_names_outside_one_to_eighty_characters() {
    let (_concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);

    for name in [String::new(), "   ".to_string(), "x".repeat(81)] {
        let error = service
            .create_view(NewView {
                name,
                spec: explore_spec(),
            })
            .unwrap_err();
        assert_eq!(error.code(), "VIEW_INVALID", "name should be rejected");
    }

    let max = service
        .create_view(NewView {
            name: "y".repeat(80),
            spec: explore_spec(),
        })
        .unwrap();
    assert_eq!(max.name.chars().count(), 80);
}

#[test]
fn view_service_enforces_the_two_hundred_view_limit() {
    let (concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);
    {
        let mut views = concrete.views.lock().unwrap();
        for index in 0..200 {
            views.push(saved_view(&format!("bulk-{index}"), i64::from(index)));
        }
    }

    let error = service
        .create_view(NewView {
            name: "Over the limit".to_string(),
            spec: explore_spec(),
        })
        .unwrap_err();

    assert_eq!(error.code(), "LIMIT_EXCEEDED");
    assert_eq!(service.count_views().unwrap(), 200);
}

#[test]
fn view_service_validates_every_explore_constraint() {
    let invalid_specs = vec![
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec![],
            from: None,
            to: None,
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec!["COL".to_string()],
            from: None,
            to: None,
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec!["ECU".to_string(), "ecu".to_string()],
            from: None,
            to: None,
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec!["ECU".to_string(), "ECU".to_string()],
            from: None,
            to: None,
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec![
                "ECU".to_string(),
                "COL".to_string(),
                "PER".to_string(),
                "CHL".to_string(),
                "BOL".to_string(),
                "WLD".to_string(),
            ],
            from: None,
            to: None,
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec!["ECU".to_string()],
            from: Some(2024),
            to: Some(2000),
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec!["ECU".to_string()],
            from: Some(1899),
            to: None,
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec!["ECU".to_string()],
            from: None,
            to: Some(2101),
            transform: Transform::Level,
            base_year: None,
            chart: ChartKind::Line,
        },
        ViewSpec::Explore {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            geographies: vec!["ECU".to_string()],
            from: None,
            to: None,
            transform: Transform::Index,
            base_year: Some(1900 - 1),
            chart: ChartKind::Line,
        },
    ];

    for spec in invalid_specs {
        let error = indicators_core::application::validate_view_spec(&spec).unwrap_err();
        assert_eq!(
            error.code(),
            "VIEW_INVALID",
            "spec {spec:?} should be invalid"
        );
    }

    indicators_core::application::validate_view_spec(&explore_spec()).unwrap();
}

#[test]
fn view_service_validates_trajectory_and_ranking_constraints() {
    let invalid_specs = vec![
        ViewSpec::Trajectories {
            indicators: vec!["NY.GDP.MKTP.CD".to_string()],
            geography: "ECU".to_string(),
            base_year: None,
        },
        ViewSpec::Trajectories {
            indicators: vec![
                "NY.GDP.MKTP.CD".to_string(),
                "SP.POP.TOTL".to_string(),
                "FP.CPI.TOTL.ZG".to_string(),
                "SL.UEM.TOTL.ZS".to_string(),
                "SI.POV.NAHC".to_string(),
            ],
            geography: "ECU".to_string(),
            base_year: None,
        },
        ViewSpec::Trajectories {
            indicators: vec!["NY.GDP.MKTP.CD".to_string(), "NY.GDP.MKTP.CD".to_string()],
            geography: "ECU".to_string(),
            base_year: None,
        },
        ViewSpec::Trajectories {
            indicators: vec!["NY.GDP.MKTP.CD".to_string(), "".to_string()],
            geography: "ECU".to_string(),
            base_year: None,
        },
        ViewSpec::Trajectories {
            indicators: vec!["NY.GDP.MKTP.CD".to_string(), "SP.POP.TOTL".to_string()],
            geography: "ecu".to_string(),
            base_year: None,
        },
        ViewSpec::Trajectories {
            indicators: vec!["NY.GDP.MKTP.CD".to_string(), "SP.POP.TOTL".to_string()],
            geography: "ECU".to_string(),
            base_year: Some(1800),
        },
        ViewSpec::Ranking {
            indicator: "".to_string(),
            year: 2024,
        },
        ViewSpec::Ranking {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            year: 2200,
        },
    ];

    for spec in invalid_specs {
        let error = indicators_core::application::validate_view_spec(&spec).unwrap_err();
        assert_eq!(
            error.code(),
            "VIEW_INVALID",
            "spec {spec:?} should be invalid"
        );
    }

    indicators_core::application::validate_view_spec(&trajectories_spec()).unwrap();
    indicators_core::application::validate_view_spec(&ranking_spec()).unwrap();
}

#[test]
fn view_service_maps_store_failures_to_storage_errors() {
    let (concrete, store) = user_store();
    let clock = Arc::new(FakeClock::at(1_000));
    let service = view_service(&store, &clock);
    concrete.fail();

    let error = service.list_views().unwrap_err();

    assert_eq!(error.code(), "STORAGE");
}

#[test]
fn settings_service_returns_documented_defaults() {
    let (_concrete, store) = user_store();
    let service = settings_service(&store);

    let settings = service.get().unwrap();

    assert_eq!(settings.theme, ThemePref::System);
    assert_eq!(settings.language, indicators_core::domain::LangPref::System);
    assert!(!settings.update_check_enabled);
    assert_eq!(settings.last_update_check, None);
    assert_eq!(settings.custom_snapshot_path, None);
}

#[test]
fn settings_service_round_trips_every_field() {
    let (_concrete, store) = user_store();
    let service = settings_service(&store);
    let settings = Settings {
        theme: ThemePref::Dark,
        language: indicators_core::domain::LangPref::Es,
        update_check_enabled: true,
        last_update_check: Some(1_700_000_000),
        custom_snapshot_path: Some("/tmp/custom.sqlite".to_string()),
    };

    service.set(&settings).unwrap();

    assert_eq!(service.get().unwrap(), settings);
}

#[test]
fn settings_service_falls_back_to_defaults_for_invalid_stored_values() {
    let (concrete, store) = user_store();
    {
        let mut settings = concrete.settings.lock().unwrap();
        settings.insert("theme".to_string(), "neon".to_string());
        settings.insert("language".to_string(), "klingon".to_string());
        settings.insert("update_check_enabled".to_string(), "maybe".to_string());
        settings.insert("last_update_check".to_string(), "yesterday".to_string());
        settings.insert("custom_snapshot_path".to_string(), String::new());
    }
    let service = settings_service(&store);

    let settings = service.get().unwrap();

    assert_eq!(settings.theme, ThemePref::System);
    assert!(!settings.update_check_enabled);
    assert_eq!(settings.last_update_check, None);
    assert_eq!(settings.custom_snapshot_path, None);
}

#[test]
fn export_service_accepts_csv_and_png_in_any_case_and_writes_bytes() {
    let writer = Arc::new(RecordingWriter::default());
    let service = ExportService::new(writer.clone());

    service
        .save(Path::new("/tmp/export.csv"), b"a,b\r\n")
        .unwrap();
    service
        .save(Path::new("/tmp/export.PNG"), b"\x89PNG")
        .unwrap();

    let writes = writer.writes.lock().unwrap();
    assert_eq!(writes.len(), 2);
    assert_eq!(writes[0].0, Path::new("/tmp/export.csv"));
    assert_eq!(writes[0].1, b"a,b\r\n");
    assert_eq!(writes[1].1, b"\x89PNG");
}

#[test]
fn export_service_rejects_every_other_extension_and_missing_file_names() {
    let writer = Arc::new(RecordingWriter::default());
    let service = ExportService::new(writer.clone());

    for path in [
        Path::new("/tmp/export.exe"),
        Path::new("/tmp/export"),
        Path::new("/tmp/export.csv.part"),
        Path::new("/tmp/"),
        Path::new("/tmp/.csv"),
    ] {
        let error = service.save(path, b"x").unwrap_err();
        assert_eq!(
            error.code(),
            "EXPORT_REJECTED",
            "{path:?} should be rejected"
        );
    }
    assert!(writer.writes.lock().unwrap().is_empty());
}

#[test]
fn export_service_rejects_content_above_fifty_mebibytes() {
    let writer = Arc::new(RecordingWriter::default());
    let service = ExportService::new(writer.clone());
    let oversized = vec![0_u8; 50 * 1024 * 1024 + 1];

    let error = service
        .save(Path::new("/tmp/big.csv"), &oversized)
        .unwrap_err();

    assert_eq!(error.code(), "EXPORT_REJECTED");
    assert!(error.to_string().contains("50 MiB"));
}

#[test]
fn export_service_propagates_writer_failures() {
    let writer = Arc::new(RecordingWriter::default());
    writer
        .failing
        .store(true, std::sync::atomic::Ordering::SeqCst);
    let service = ExportService::new(writer);

    let error = service
        .save(Path::new("/tmp/export.csv"), b"x")
        .unwrap_err();

    assert_eq!(error.code(), "STORAGE");
}

fn update_service(
    store: &Arc<dyn UserStore>,
    feed: &Arc<FakeReleaseFeed>,
    clock: &Arc<FakeClock>,
) -> UpdateService {
    let settings = Arc::new(settings_service(store));
    UpdateService::new(feed.clone(), settings, clock.clone())
}

#[test]
fn update_check_is_disabled_by_default_and_never_calls_the_feed() {
    let (_concrete, store) = user_store();
    let feed = Arc::new(FakeReleaseFeed::returning(released("v0.2.0")));
    let clock = Arc::new(FakeClock::at(1_000));
    let service = update_service(&store, &feed, &clock);

    let status = service.check("0.1.0", false).unwrap();

    assert_eq!(
        status,
        UpdateStatus::Disabled {
            current: "0.1.0".to_string()
        }
    );
    assert_eq!(feed.calls(), 0);
}

#[test]
fn update_check_reports_an_available_release() {
    let (concrete, store) = user_store();
    let feed = Arc::new(FakeReleaseFeed::returning(released("v0.2.0")));
    let clock = Arc::new(FakeClock::at(1_000));
    let service = update_service(&store, &feed, &clock);

    let status = service.check("0.1.0", true).unwrap();

    assert_eq!(
        status,
        UpdateStatus::Available {
            current: "0.1.0".to_string(),
            latest: "0.2.0".to_string(),
            url: "https://example.test/releases/tag/v0.2.0".to_string(),
            published_at: Some("2026-12-01T10:00:00Z".to_string()),
        }
    );
    assert_eq!(feed.calls(), 1);
    let settings = settings_service(&store);
    assert_eq!(settings.get().unwrap().last_update_check, Some(1_000));
    assert!(!settings.get().unwrap().update_check_enabled);
    assert_eq!(concrete.views.lock().unwrap().len(), 0);
}

#[test]
fn update_check_reports_up_to_date_when_versions_match_or_are_newer() {
    for tag in ["v0.1.0", "v0.0.9"] {
        let (concrete, store) = user_store();
        let mut settings = default_settings();
        settings.update_check_enabled = true;
        settings_service(&store).set(&settings).unwrap();
        let feed = Arc::new(FakeReleaseFeed::returning(released(tag)));
        let clock = Arc::new(FakeClock::at(1_000));
        let service = update_service(&store, &feed, &clock);

        let status = service.check("0.1.0", false).unwrap();

        assert_eq!(
            status,
            UpdateStatus::UpToDate {
                current: "0.1.0".to_string()
            },
            "tag {tag}"
        );
        let _ = concrete;
    }
}

#[test]
fn update_check_throttles_non_forced_checks_for_twenty_four_hours() {
    let (concrete, store) = user_store();
    let mut settings = default_settings();
    settings.update_check_enabled = true;
    settings.last_update_check = Some(1_000 - 3_600);
    settings_service(&store).set(&settings).unwrap();
    let feed = Arc::new(FakeReleaseFeed::returning(released("v0.2.0")));
    let clock = Arc::new(FakeClock::at(1_000));
    let service = update_service(&store, &feed, &clock);

    let status = service.check("0.1.0", false).unwrap();

    assert_eq!(
        status,
        UpdateStatus::Disabled {
            current: "0.1.0".to_string()
        }
    );
    assert_eq!(feed.calls(), 0);
    assert_eq!(concrete.views.lock().unwrap().len(), 0);
}

#[test]
fn update_check_runs_again_after_the_throttle_window_and_force_bypasses_it() {
    let (_concrete, store) = user_store();
    let mut settings = default_settings();
    settings.update_check_enabled = true;
    settings.last_update_check = Some(1_000 - 86_400);
    settings_service(&store).set(&settings).unwrap();
    let feed = Arc::new(FakeReleaseFeed::returning(released("v0.2.0")));
    let clock = Arc::new(FakeClock::at(1_000));
    let service = update_service(&store, &feed, &clock);

    service.check("0.1.0", false).unwrap();
    assert_eq!(feed.calls(), 1);

    clock.set(2_000);
    service.check("0.1.0", true).unwrap();
    assert_eq!(feed.calls(), 2);
    assert_eq!(
        settings_service(&store).get().unwrap().last_update_check,
        Some(2_000)
    );
}

#[test]
fn update_check_ignores_draft_and_prerelease_releases() {
    for (draft, prerelease) in [(true, false), (false, true)] {
        let (_concrete, store) = user_store();
        let mut release = released("v9.9.9");
        release.draft = draft;
        release.prerelease = prerelease;
        let feed = Arc::new(FakeReleaseFeed::returning(release));
        let clock = Arc::new(FakeClock::at(1_000));
        let service = update_service(&store, &feed, &clock);

        let status = service.check("0.1.0", true).unwrap();

        assert_eq!(
            status,
            UpdateStatus::UpToDate {
                current: "0.1.0".to_string()
            }
        );
    }
}

#[test]
fn update_check_maps_invalid_tags_and_feed_failures() {
    let (_concrete, store) = user_store();
    let feed = Arc::new(FakeReleaseFeed::returning(released("not-a-version")));
    let clock = Arc::new(FakeClock::at(1_000));
    let service = update_service(&store, &feed, &clock);
    assert_eq!(
        service.check("0.1.0", true).unwrap_err().code(),
        "UPDATE_FEED"
    );

    let feed = Arc::new(FakeReleaseFeed::failing(CoreError::network("offline")));
    let service = update_service(&store, &feed, &clock);
    assert_eq!(service.check("0.1.0", true).unwrap_err().code(), "NETWORK");
}

#[test]
fn update_check_does_not_record_the_timestamp_on_failure() {
    let (_concrete, store) = user_store();
    let feed = Arc::new(FakeReleaseFeed::failing(CoreError::network("offline")));
    let clock = Arc::new(FakeClock::at(1_000));
    let service = update_service(&store, &feed, &clock);

    service.check("0.1.0", true).unwrap_err();

    assert_eq!(
        settings_service(&store).get().unwrap().last_update_check,
        None
    );
}

#[test]
fn version_comparison_ignores_a_leading_v_and_is_antisymmetric() {
    use indicators_core::domain::is_newer;

    assert!(is_newer("0.1.0", "v0.2.0").unwrap());
    assert!(!is_newer("0.1.0", "v0.1.0").unwrap());
    assert!(!is_newer("0.1.0", "v0.0.9").unwrap());
    assert!(is_newer("v1.2.3", "V1.2.4").unwrap());
    assert_eq!(
        is_newer("0.1.0", "banana").unwrap_err().code(),
        "UPDATE_FEED"
    );
    assert_eq!(is_newer("banana", "0.1.0").unwrap_err().code(), "INTERNAL");
}
