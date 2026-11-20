//! SQLite snapshot adapter: opens schema-v1 snapshots read-only and reads the
//! catalog and observations without ever mutating the file.

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::{Connection, OpenFlags, params_from_iter};

use crate::domain::{
    Catalog, CoreError, DatasetCounts, DatasetInfo, Geography, HigherIs, Indicator, Observation,
    Topic, ValueKind,
};
use crate::ports::{SnapshotOpener, SnapshotReader};

const REQUIRED_TABLES: [&str; 5] = ["meta", "topic", "geography", "indicator", "observation"];
const REQUIRED_META: [&str; 13] = [
    "schema_version",
    "dataset_id",
    "dataset_version",
    "origin",
    "source_name",
    "source_publisher",
    "source_last_updated",
    "retrieved_at",
    "license",
    "license_url",
    "attribution_en",
    "attribution_es",
    "pipeline_version",
];

fn invalid(message: impl Into<String>) -> CoreError {
    CoreError::snapshot_invalid(message)
}

fn lock(connection: &Mutex<Connection>) -> Result<MutexGuard<'_, Connection>, CoreError> {
    connection
        .lock()
        .map_err(|_| CoreError::internal("snapshot lock poisoned"))
}

fn table_exists(connection: &Connection, name: &str) -> Result<bool, CoreError> {
    connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
            [name],
            |row| row.get::<_, i64>(0),
        )
        .map(|count| count > 0)
        .map_err(|error| invalid(format!("cannot inspect snapshot schema: {error}")))
}

fn read_meta(
    connection: &Connection,
) -> Result<std::collections::HashMap<String, String>, CoreError> {
    let mut statement = connection
        .prepare("SELECT key, value FROM meta")
        .map_err(|error| invalid(format!("cannot read meta table: {error}")))?;
    let rows = statement
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| invalid(format!("cannot read meta table: {error}")))?;
    let mut meta = std::collections::HashMap::new();
    for row in rows {
        let (key, value) =
            row.map_err(|error| invalid(format!("cannot read meta row: {error}")))?;
        meta.insert(key, value);
    }
    Ok(meta)
}

fn count(connection: &Connection, table: &str) -> Result<usize, CoreError> {
    let count = connection
        .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
            row.get::<_, i64>(0)
        })
        .map_err(|error| invalid(format!("cannot count {table} rows: {error}")))?;
    usize::try_from(count).map_err(|_| invalid(format!("negative {table} row count")))
}

fn build_info(
    connection: &Connection,
    meta: &std::collections::HashMap<String, String>,
) -> Result<DatasetInfo, CoreError> {
    for key in REQUIRED_META {
        if !meta.contains_key(key) {
            return Err(invalid(format!("snapshot meta is missing the {key:?} key")));
        }
    }
    let schema_version = meta["schema_version"]
        .parse::<u32>()
        .map_err(|error| invalid(format!("invalid meta.schema_version: {error}")))?;
    if schema_version != 1 {
        return Err(invalid(format!(
            "unsupported meta.schema_version {schema_version}, expected 1"
        )));
    }
    Ok(DatasetInfo {
        schema_version,
        origin: meta["origin"].clone(),
        dataset_id: meta["dataset_id"].clone(),
        dataset_version: meta["dataset_version"].clone(),
        source_name: meta["source_name"].clone(),
        source_publisher: meta["source_publisher"].clone(),
        source_last_updated: meta["source_last_updated"].clone(),
        retrieved_at: meta["retrieved_at"].clone(),
        license: meta["license"].clone(),
        license_url: meta["license_url"].clone(),
        attribution_en: meta["attribution_en"].clone(),
        attribution_es: meta["attribution_es"].clone(),
        counts: DatasetCounts {
            topics: count(connection, "topic")?,
            geographies: count(connection, "geography")?,
            indicators: count(connection, "indicator")?,
            observations: count(connection, "observation")?,
        },
    })
}

fn validate(connection: &Connection) -> Result<DatasetInfo, CoreError> {
    let user_version: i64 = connection
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .map_err(|error| invalid(format!("cannot read snapshot schema version: {error}")))?;
    if user_version != 1 {
        return Err(invalid(format!(
            "unsupported snapshot schema version {user_version}, expected 1"
        )));
    }
    for table in REQUIRED_TABLES {
        if !table_exists(connection, table)? {
            return Err(invalid(format!("snapshot is missing the {table} table")));
        }
    }
    let meta = read_meta(connection)?;
    match meta.get("schema_version").map(String::as_str) {
        Some("1") => {}
        Some(other) => {
            return Err(invalid(format!(
                "unsupported meta.schema_version {other:?}, expected \"1\""
            )));
        }
        None => return Err(invalid("snapshot meta is missing schema_version")),
    }
    let check: String = connection
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|error| invalid(format!("snapshot integrity check failed: {error}")))?;
    if check != "ok" {
        return Err(invalid(format!("snapshot integrity check failed: {check}")));
    }
    build_info(connection, &meta)
}

fn parse_value_kind(raw: &str) -> Result<ValueKind, CoreError> {
    match raw {
        "currency" => Ok(ValueKind::Currency),
        "percent" => Ok(ValueKind::Percent),
        "number" => Ok(ValueKind::Number),
        "years" => Ok(ValueKind::Years),
        "rate" => Ok(ValueKind::Rate),
        "index" => Ok(ValueKind::Index),
        other => Err(invalid(format!("unknown value_kind {other:?}"))),
    }
}

fn parse_higher_is(raw: &str) -> Result<HigherIs, CoreError> {
    match raw {
        "better" => Ok(HigherIs::Better),
        "worse" => Ok(HigherIs::Worse),
        "neutral" => Ok(HigherIs::Neutral),
        other => Err(invalid(format!("unknown higher_is {other:?}"))),
    }
}

/// Read-only snapshot reader. The connection is shared behind a mutex because
/// `rusqlite::Connection` is `Send` but not `Sync`.
pub struct SqliteSnapshotReader {
    connection: Mutex<Connection>,
    info: DatasetInfo,
}

impl SqliteSnapshotReader {
    /// Opens and validates a snapshot file.
    ///
    /// # Errors
    /// `SNAPSHOT_NOT_FOUND` when the file is absent; `SNAPSHOT_INVALID` for a
    /// corrupt file, wrong schema version, missing tables or failed integrity
    /// check.
    pub fn open(path: &Path) -> Result<Self, CoreError> {
        if !path.is_file() {
            return Err(CoreError::snapshot_not_found(path.display().to_string()));
        }
        let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
            .map_err(|error| {
                invalid(format!("cannot open snapshot {}: {error}", path.display()))
            })?;
        connection
            .pragma_update(None, "query_only", true)
            .map_err(|error| invalid(format!("cannot enforce read-only access: {error}")))?;
        let info = validate(&connection)?;
        Ok(Self {
            connection: Mutex::new(connection),
            info,
        })
    }
}

impl SnapshotReader for SqliteSnapshotReader {
    fn info(&self) -> Result<DatasetInfo, CoreError> {
        Ok(self.info.clone())
    }

    fn catalog(&self) -> Result<Catalog, CoreError> {
        let connection = lock(&self.connection)?;
        let topics = {
            let mut statement = connection
                .prepare(
                    "SELECT id, name_en, name_es, sort_order FROM topic \
                     ORDER BY sort_order ASC, id ASC",
                )
                .map_err(|error| invalid(format!("cannot read topics: {error}")))?;
            let rows = statement
                .query_map([], |row| {
                    Ok(Topic {
                        id: row.get(0)?,
                        name_en: row.get(1)?,
                        name_es: row.get(2)?,
                        sort_order: row.get(3)?,
                    })
                })
                .map_err(|error| invalid(format!("cannot read topics: {error}")))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| invalid(format!("cannot read topic row: {error}")))?
        };
        let geographies = {
            let mut statement = connection
                .prepare(
                    "SELECT iso3, iso2, name_en, name_es, is_aggregate, sort_order \
                     FROM geography ORDER BY sort_order ASC, iso3 ASC",
                )
                .map_err(|error| invalid(format!("cannot read geographies: {error}")))?;
            let rows = statement
                .query_map([], |row| {
                    let aggregate: i64 = row.get(4)?;
                    Ok(Geography {
                        iso3: row.get(0)?,
                        iso2: row.get(1)?,
                        name_en: row.get(2)?,
                        name_es: row.get(3)?,
                        is_aggregate: aggregate != 0,
                        sort_order: row.get(5)?,
                    })
                })
                .map_err(|error| invalid(format!("cannot read geographies: {error}")))?;
            rows.collect::<Result<Vec<_>, _>>()
                .map_err(|error| invalid(format!("cannot read geography row: {error}")))?
        };
        let indicators = {
            let mut statement = connection
                .prepare(
                    "SELECT code, topic_id, name_en, name_es, description_en, description_es, \
                     unit_en, unit_es, value_kind, decimals, higher_is, source_org_en, \
                     source_org_es, sort_order FROM indicator ORDER BY sort_order ASC, code ASC",
                )
                .map_err(|error| invalid(format!("cannot read indicators: {error}")))?;
            let rows = statement
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, String>(3)?,
                        row.get::<_, String>(4)?,
                        row.get::<_, String>(5)?,
                        row.get::<_, String>(6)?,
                        row.get::<_, String>(7)?,
                        row.get::<_, String>(8)?,
                        row.get::<_, i32>(9)?,
                        row.get::<_, String>(10)?,
                        row.get::<_, String>(11)?,
                        row.get::<_, String>(12)?,
                        row.get::<_, i32>(13)?,
                    ))
                })
                .map_err(|error| invalid(format!("cannot read indicators: {error}")))?;
            let mut output = Vec::new();
            for row in rows {
                let row =
                    row.map_err(|error| invalid(format!("cannot read indicator row: {error}")))?;
                output.push(Indicator {
                    code: row.0,
                    topic_id: row.1,
                    name_en: row.2,
                    name_es: row.3,
                    description_en: row.4,
                    description_es: row.5,
                    unit_en: row.6,
                    unit_es: row.7,
                    value_kind: parse_value_kind(&row.8)?,
                    decimals: row.9,
                    higher_is: parse_higher_is(&row.10)?,
                    source_org_en: row.11,
                    source_org_es: row.12,
                    sort_order: row.13,
                });
            }
            output
        };
        Ok(Catalog {
            topics,
            geographies,
            indicators,
        })
    }

    fn observations(
        &self,
        indicator_codes: &[String],
        iso3s: &[String],
    ) -> Result<Vec<Observation>, CoreError> {
        if indicator_codes.is_empty() || iso3s.is_empty() {
            return Ok(Vec::new());
        }
        let connection = lock(&self.connection)?;
        let code_placeholders = std::iter::repeat_n("?", indicator_codes.len())
            .collect::<Vec<_>>()
            .join(",");
        let iso_placeholders = std::iter::repeat_n("?", iso3s.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!(
            "SELECT indicator_code, iso3, year, value FROM observation \
             WHERE indicator_code IN ({code_placeholders}) AND iso3 IN ({iso_placeholders}) \
             ORDER BY indicator_code ASC, iso3 ASC, year ASC"
        );
        let mut statement = connection
            .prepare(&sql)
            .map_err(|error| invalid(format!("cannot read observations: {error}")))?;
        let params = indicator_codes
            .iter()
            .chain(iso3s.iter())
            .map(String::as_str);
        let rows = statement
            .query_map(params_from_iter(params), |row| {
                Ok(Observation {
                    indicator_code: row.get(0)?,
                    iso3: row.get(1)?,
                    year: row.get(2)?,
                    value: row.get(3)?,
                })
            })
            .map_err(|error| invalid(format!("cannot read observations: {error}")))?;
        rows.collect::<Result<Vec<_>, _>>()
            .map_err(|error| invalid(format!("cannot read observation row: {error}")))
    }
}

/// Production opener used by the composition root.
pub struct SqliteSnapshotOpener;

impl SnapshotOpener for SqliteSnapshotOpener {
    fn open(&self, path: &Path) -> Result<Box<dyn SnapshotReader>, CoreError> {
        Ok(Box::new(SqliteSnapshotReader::open(path)?))
    }
}
