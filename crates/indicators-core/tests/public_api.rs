//! Direct coverage for the public API surface that other tests exercise only
//! indirectly (error mapping, helpers, system adapters, schema version).

use std::path::Path;

use indicators_core::adapters::sqlite_user_store::SqliteUserStore;
use indicators_core::adapters::system::{SystemClock, UuidGenerator};
use indicators_core::application::{MAX_NAME_CHARS, validate_view_name};
use indicators_core::domain::{CoreError, ErrorDto, UpdateStatus, parse_version};
use indicators_core::ports::{Clock, IdGenerator, UserStore};

#[test]
fn every_error_variant_maps_to_its_stable_code_and_dto() {
    let cases = [
        (CoreError::snapshot_invalid("x"), "SNAPSHOT_INVALID"),
        (CoreError::snapshot_not_found("/x"), "SNAPSHOT_NOT_FOUND"),
        (CoreError::view_not_found("id"), "VIEW_NOT_FOUND"),
        (CoreError::view_invalid("x"), "VIEW_INVALID"),
        (CoreError::limit_exceeded("x"), "LIMIT_EXCEEDED"),
        (CoreError::storage("x"), "STORAGE"),
        (CoreError::export_rejected("x"), "EXPORT_REJECTED"),
        (CoreError::update_feed("x"), "UPDATE_FEED"),
        (CoreError::network("x"), "NETWORK"),
        (CoreError::internal("x"), "INTERNAL"),
    ];

    for (error, code) in cases {
        assert_eq!(error.code(), code);
        let dto = ErrorDto::from(&error);
        assert_eq!(dto.code, code);
        assert_eq!(dto.message, error.to_string());
        let owned = ErrorDto::from(error);
        assert_eq!(owned.code, code);
    }
}

#[test]
fn view_name_validation_accepts_one_to_eighty_characters() {
    assert!(validate_view_name("a").is_ok());
    assert!(validate_view_name(&"x".repeat(MAX_NAME_CHARS)).is_ok());
    assert!(validate_view_name(&"x".repeat(MAX_NAME_CHARS + 1)).is_err());
    assert!(validate_view_name("   ").is_err());
    assert!(validate_view_name("  trimmed  ").is_ok());
}

#[test]
fn update_status_constructors_carry_the_current_version() {
    assert_eq!(
        UpdateStatus::up_to_date("0.1.0"),
        UpdateStatus::UpToDate {
            current: "0.1.0".to_string()
        }
    );
    assert_eq!(
        UpdateStatus::disabled("0.1.0"),
        UpdateStatus::Disabled {
            current: "0.1.0".to_string()
        }
    );
    assert_eq!(parse_version("v1.2.3", false).unwrap().to_string(), "1.2.3");
    assert_eq!(parse_version("1.2.3", true).unwrap().to_string(), "1.2.3");
}

#[test]
fn system_clock_returns_a_plausible_unix_timestamp() {
    let now = SystemClock.now_unix();
    assert!(now > 1_700_000_000, "unexpected clock value {now}");
    assert!(now < 4_000_000_000, "unexpected clock value {now}");
}

#[test]
fn uuid_generator_returns_distinct_v4_ids() {
    let generator = UuidGenerator;
    let first = generator.new_id();
    let second = generator.new_id();

    assert_ne!(first, second);
    assert_eq!(first.len(), 36);
    assert_eq!(first.as_bytes()[14], b'4', "expected UUID v4: {first}");
}

#[test]
fn user_store_reports_the_migrated_schema_version() {
    let store = SqliteUserStore::open(Path::new(":memory:")).unwrap();

    assert_eq!(store.schema_version().unwrap(), 1);
    assert_eq!(store.count_views().unwrap(), 0);
}
