//! Integration tests for the SQLite user store (real files, temp directories).

use std::path::Path;

use indicators_core::adapters::sqlite_user_store::SqliteUserStore;
use indicators_core::domain::SavedView;
use indicators_core::ports::UserStore;

fn saved(id: &str, name: &str, updated_at: i64) -> SavedView {
    SavedView {
        id: id.to_string(),
        name: name.to_string(),
        spec: indicators_core::domain::ViewSpec::Ranking {
            indicator: "NY.GDP.MKTP.CD".to_string(),
            year: 2024,
        },
        created_at: 1_000,
        updated_at,
    }
}

#[test]
fn creates_the_schema_idempotently_and_persists_views() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("user.db");

    {
        let store = SqliteUserStore::open(&path).unwrap();
        assert!(store.list_views().unwrap().is_empty());
        store.insert_view(&saved("a", "Alpha", 10)).unwrap();
        assert_eq!(store.count_views().unwrap(), 1);
    }

    // Reopening must run the migration safely and keep the rows.
    let store = SqliteUserStore::open(&path).unwrap();
    let views = store.list_views().unwrap();
    assert_eq!(views.len(), 1);
    assert_eq!(views[0].name, "Alpha");
}

#[test]
fn reads_updates_and_deletes_views() {
    let store = SqliteUserStore::open(Path::new(":memory:")).unwrap();
    store.insert_view(&saved("a", "Alpha", 10)).unwrap();

    let found = store.get_view("a").unwrap().unwrap();
    assert_eq!(found.name, "Alpha");
    assert!(store.get_view("missing").unwrap().is_none());

    let mut renamed = found.clone();
    renamed.name = "Renamed".to_string();
    renamed.updated_at = 20;
    store.update_view(&renamed).unwrap();
    assert_eq!(store.get_view("a").unwrap().unwrap().name, "Renamed");

    assert!(store.delete_view("a").unwrap());
    assert!(!store.delete_view("a").unwrap());
    assert!(store.get_view("a").unwrap().is_none());
}

#[test]
fn update_and_delete_report_missing_views() {
    let store = SqliteUserStore::open(Path::new(":memory:")).unwrap();

    let error = store.update_view(&saved("missing", "x", 1)).unwrap_err();
    assert_eq!(error.code(), "VIEW_NOT_FOUND");
    assert!(!store.delete_view("missing").unwrap());
}

#[test]
fn lists_views_by_updated_at_descending_then_id() {
    let store = SqliteUserStore::open(Path::new(":memory:")).unwrap();
    store.insert_view(&saved("a", "Alpha", 10)).unwrap();
    store.insert_view(&saved("c", "Gamma", 30)).unwrap();
    store.insert_view(&saved("b", "Beta", 30)).unwrap();

    let ids: Vec<String> = store
        .list_views()
        .unwrap()
        .into_iter()
        .map(|v| v.id)
        .collect();

    assert_eq!(ids, vec!["b", "c", "a"]);
}

#[test]
fn counts_up_to_the_documented_limit() {
    let store = SqliteUserStore::open(Path::new(":memory:")).unwrap();
    for index in 0..200 {
        store
            .insert_view(&saved(&format!("v-{index}"), "View", i64::from(index)))
            .unwrap();
    }

    assert_eq!(store.count_views().unwrap(), 200);
}

#[test]
fn rejects_duplicate_ids_as_storage_errors() {
    let store = SqliteUserStore::open(Path::new(":memory:")).unwrap();
    store.insert_view(&saved("a", "Alpha", 10)).unwrap();

    let error = store.insert_view(&saved("a", "Again", 11)).unwrap_err();

    assert_eq!(error.code(), "STORAGE");
}

#[test]
fn round_trips_settings_and_overwrites_values() {
    let store = SqliteUserStore::open(Path::new(":memory:")).unwrap();

    assert_eq!(store.get_setting("theme").unwrap(), None);
    store.set_setting("theme", "dark").unwrap();
    store.set_setting("theme", "light").unwrap();

    assert_eq!(
        store.get_setting("theme").unwrap().as_deref(),
        Some("light")
    );
}

#[test]
fn reports_corrupt_spec_json_as_an_invalid_view() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("user.db");
    let store = SqliteUserStore::open(&path).unwrap();
    store.insert_view(&saved("a", "Alpha", 10)).unwrap();
    drop(store);

    let connection = rusqlite::Connection::open(&path).unwrap();
    connection
        .execute(
            "UPDATE saved_view SET spec_json = 'not json' WHERE id = 'a'",
            [],
        )
        .unwrap();
    drop(connection);

    let store = SqliteUserStore::open(&path).unwrap();
    let error = store.get_view("a").unwrap_err();

    assert_eq!(error.code(), "VIEW_INVALID");
}
