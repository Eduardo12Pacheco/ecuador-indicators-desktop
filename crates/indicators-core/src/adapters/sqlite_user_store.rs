//! SQLite user store for saved views and settings (D16).
//!
//! Migrations run through `rusqlite_migration` on every open and are
//! idempotent. File databases use WAL; tests may use `:memory:`.

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::{Connection, OptionalExtension};
use rusqlite_migration::{M, Migrations};

use crate::domain::{CoreError, SavedView};
use crate::ports::UserStore;

const MIGRATION_1: &str = r"
CREATE TABLE saved_view (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    spec_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE INDEX idx_saved_view_updated_at ON saved_view(updated_at DESC);
CREATE TABLE setting (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
";

fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(MIGRATION_1)])
}

fn storage(context: &str, error: impl std::fmt::Display) -> CoreError {
    CoreError::storage(format!("{context}: {error}"))
}

fn lock(connection: &Mutex<Connection>) -> Result<MutexGuard<'_, Connection>, CoreError> {
    connection
        .lock()
        .map_err(|_| CoreError::internal("user store lock poisoned"))
}

type ViewRow = (String, String, String, i64, i64);

fn decode_view(row: ViewRow) -> Result<SavedView, CoreError> {
    let (id, name, spec_json, created_at, updated_at) = row;
    let spec = serde_json::from_str(&spec_json).map_err(|error| {
        CoreError::view_invalid(format!("saved view {id:?} has invalid spec JSON: {error}"))
    })?;
    Ok(SavedView {
        id,
        name,
        spec,
        created_at,
        updated_at,
    })
}

/// SQLite-backed implementation of the user store.
pub struct SqliteUserStore {
    connection: Mutex<Connection>,
}

impl SqliteUserStore {
    /// Opens (or creates) a user database and applies pending migrations.
    ///
    /// # Errors
    /// `STORAGE` when the directory, database or migration cannot be prepared.
    pub fn open(path: &Path) -> Result<Self, CoreError> {
        let in_memory = path.as_os_str() == ":memory:";
        if !in_memory
            && let Some(parent) = path.parent()
            && !parent.as_os_str().is_empty()
            && !parent.exists()
        {
            std::fs::create_dir_all(parent)
                .map_err(|error| storage("cannot create the app data directory", error))?;
        }
        let mut connection = Connection::open(path)
            .map_err(|error| storage(&format!("cannot open {}", path.display()), error))?;
        connection
            .pragma_update(None, "foreign_keys", true)
            .map_err(|error| storage("cannot enable foreign keys", error))?;
        if !in_memory {
            let _mode: String = connection
                .query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))
                .map_err(|error| storage("cannot enable WAL", error))?;
        }
        migrations()
            .to_latest(&mut connection)
            .map_err(|error| storage("cannot migrate the user database", error))?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    /// Schema version applied by the migrations (1 for the current schema).
    ///
    /// # Errors
    /// `STORAGE` when the version cannot be read.
    pub fn schema_version(&self) -> Result<usize, CoreError> {
        let connection = lock(&self.connection)?;
        let version = migrations()
            .current_version(&connection)
            .map_err(|error| storage("cannot read the user schema version", error))?;
        Ok(usize::from(version))
    }
}

impl UserStore for SqliteUserStore {
    fn list_views(&self) -> Result<Vec<SavedView>, CoreError> {
        let connection = lock(&self.connection)?;
        let mut statement = connection
            .prepare(
                "SELECT id, name, spec_json, created_at, updated_at FROM saved_view \
                 ORDER BY updated_at DESC, id ASC",
            )
            .map_err(|error| storage("cannot read saved views", error))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)?,
                    row.get::<_, i64>(4)?,
                ))
            })
            .map_err(|error| storage("cannot read saved views", error))?;
        let mut views = Vec::new();
        for row in rows {
            let row = row.map_err(|error| storage("cannot read saved view", error))?;
            views.push(decode_view(row)?);
        }
        Ok(views)
    }

    fn get_view(&self, id: &str) -> Result<Option<SavedView>, CoreError> {
        let connection = lock(&self.connection)?;
        let row = connection
            .query_row(
                "SELECT id, name, spec_json, created_at, updated_at FROM saved_view WHERE id = ?1",
                [id],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, i64>(3)?,
                        row.get::<_, i64>(4)?,
                    ))
                },
            )
            .optional()
            .map_err(|error| storage("cannot read saved view", error))?;
        row.map(decode_view).transpose()
    }

    fn insert_view(&self, view: &SavedView) -> Result<(), CoreError> {
        let spec_json = serde_json::to_string(&view.spec)
            .map_err(|error| CoreError::internal(format!("cannot serialize view spec: {error}")))?;
        let connection = lock(&self.connection)?;
        connection
            .execute(
                "INSERT INTO saved_view (id, name, spec_json, created_at, updated_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![
                    view.id,
                    view.name,
                    spec_json,
                    view.created_at,
                    view.updated_at
                ],
            )
            .map(|_| ())
            .map_err(|error| storage("cannot insert saved view", error))
    }

    fn update_view(&self, view: &SavedView) -> Result<(), CoreError> {
        let spec_json = serde_json::to_string(&view.spec)
            .map_err(|error| CoreError::internal(format!("cannot serialize view spec: {error}")))?;
        let connection = lock(&self.connection)?;
        let changed = connection
            .execute(
                "UPDATE saved_view SET name = ?2, spec_json = ?3, updated_at = ?4 WHERE id = ?1",
                rusqlite::params![view.id, view.name, spec_json, view.updated_at],
            )
            .map_err(|error| storage("cannot update saved view", error))?;
        if changed == 0 {
            return Err(CoreError::view_not_found(view.id.clone()));
        }
        Ok(())
    }

    fn delete_view(&self, id: &str) -> Result<bool, CoreError> {
        let connection = lock(&self.connection)?;
        connection
            .execute("DELETE FROM saved_view WHERE id = ?1", [id])
            .map(|changed| changed > 0)
            .map_err(|error| storage("cannot delete saved view", error))
    }

    fn count_views(&self) -> Result<usize, CoreError> {
        let connection = lock(&self.connection)?;
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM saved_view", [], |row| row.get(0))
            .map_err(|error| storage("cannot count saved views", error))?;
        usize::try_from(count).map_err(|_| CoreError::storage("negative saved-view count"))
    }

    fn get_setting(&self, key: &str) -> Result<Option<String>, CoreError> {
        let connection = lock(&self.connection)?;
        connection
            .query_row("SELECT value FROM setting WHERE key = ?1", [key], |row| {
                row.get::<_, String>(0)
            })
            .optional()
            .map_err(|error| storage("cannot read setting", error))
    }

    fn set_setting(&self, key: &str, value: &str) -> Result<(), CoreError> {
        let connection = lock(&self.connection)?;
        connection
            .execute(
                "INSERT INTO setting (key, value) VALUES (?1, ?2) \
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [key, value],
            )
            .map(|_| ())
            .map_err(|error| storage("cannot write setting", error))
    }
}
