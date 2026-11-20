//! Headless `--self-check` implementation (S15).
//!
//! The report is written as JSON and the process exit code follows `ok`. The
//! snapshot file hash is compared with the bundled `data/MANIFEST.json`, while
//! the user store is opened with the same migrations the app uses (idempotent).

use std::fs;
use std::path::{Path, PathBuf};

use indicators_core::adapters::sqlite_snapshot::SqliteSnapshotReader;
use indicators_core::adapters::sqlite_user_store::SqliteUserStore;
use indicators_core::ports::SnapshotReader;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::config::AppConfig;

/// Snapshot section of the self-check report.
#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct SnapshotReport {
    pub schema_version: u32,
    pub indicators: usize,
    pub geographies: usize,
    pub observations: usize,
    pub file_sha256_ok: bool,
    pub origin: String,
}

/// User-store section of the self-check report.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct UserStoreReport {
    pub ok: bool,
    pub schema_version: usize,
}

/// The complete JSON document written by `--self-check --out <path>`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelfCheckReport {
    pub ok: bool,
    pub app_version: String,
    pub snapshot: SnapshotReport,
    pub user_store: UserStoreReport,
    pub errors: Vec<String>,
}

/// Everything the self-check needs, injected so tests can use any fixture.
#[derive(Debug, Clone)]
pub struct Options {
    pub app_version: String,
    pub snapshot_path: PathBuf,
    pub manifest_path: Option<PathBuf>,
    pub home_dir: PathBuf,
}

#[derive(Debug, Deserialize)]
struct Manifest {
    snapshot: ManifestSnapshot,
}

#[derive(Debug, Deserialize)]
struct ManifestSnapshot {
    sha256: String,
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn expected_sha256(manifest_path: &Path) -> Result<String, String> {
    let raw = fs::read_to_string(manifest_path)
        .map_err(|error| format!("cannot read {}: {error}", manifest_path.display()))?;
    let manifest: Manifest = serde_json::from_str(&raw)
        .map_err(|error| format!("cannot parse {}: {error}", manifest_path.display()))?;
    if manifest.snapshot.sha256.trim().is_empty() {
        return Err(format!(
            "{} has an empty snapshot.sha256",
            manifest_path.display()
        ));
    }
    Ok(manifest.snapshot.sha256.trim().to_string())
}

/// Runs the self-check without touching a window.
#[must_use]
pub fn run(options: &Options) -> SelfCheckReport {
    let mut errors = Vec::new();
    let mut snapshot = SnapshotReport::default();
    let mut snapshot_ok = false;

    match SqliteSnapshotReader::open(&options.snapshot_path) {
        Ok(reader) => match reader.info() {
            Ok(info) => {
                snapshot.schema_version = info.schema_version;
                snapshot.indicators = info.counts.indicators;
                snapshot.geographies = info.counts.geographies;
                snapshot.observations = info.counts.observations;
                snapshot.origin = info.origin;
                snapshot_ok = true;
            }
            Err(error) => errors.push(format!("snapshot info: {error}")),
        },
        Err(error) => errors.push(format!("snapshot: {error}")),
    }

    let mut file_sha256_ok = false;
    match fs::read(&options.snapshot_path) {
        Ok(bytes) => {
            let actual = sha256_hex(&bytes);
            match &options.manifest_path {
                Some(manifest_path) => match expected_sha256(manifest_path) {
                    Ok(expected) => {
                        file_sha256_ok = actual.eq_ignore_ascii_case(&expected);
                        if !file_sha256_ok {
                            errors.push(format!(
                                "snapshot sha256 mismatch: expected {expected}, actual {actual}"
                            ));
                        }
                    }
                    Err(error) => errors.push(format!("manifest: {error}")),
                },
                None => errors.push(
                    "manifest: data/MANIFEST.json was not found next to the snapshot".to_string(),
                ),
            }
        }
        Err(error) => errors.push(format!(
            "cannot read snapshot {}: {error}",
            options.snapshot_path.display()
        )),
    }
    snapshot.file_sha256_ok = file_sha256_ok;

    let mut user_store = UserStoreReport::default();
    let user_database = options.home_dir.join("user.db");
    match SqliteUserStore::open(&user_database) {
        Ok(store) => match store.schema_version() {
            Ok(version) => {
                user_store.ok = true;
                user_store.schema_version = version;
            }
            Err(error) => errors.push(format!("user store: {error}")),
        },
        Err(error) => errors.push(format!("user store: {error}")),
    }

    let ok = snapshot_ok && file_sha256_ok && user_store.ok && errors.is_empty();
    SelfCheckReport {
        ok,
        app_version: options.app_version.clone(),
        snapshot,
        user_store,
        errors,
    }
}

/// Writes the report as pretty JSON with a trailing newline.
///
/// # Errors
/// Returns a message when the parent directory or file cannot be written.
pub fn write(report: &SelfCheckReport, out: &Path) -> Result<(), String> {
    if let Some(parent) = out.parent().filter(|parent| !parent.as_os_str().is_empty()) {
        fs::create_dir_all(parent)
            .map_err(|error| format!("cannot create {}: {error}", parent.display()))?;
    }
    let mut body = serde_json::to_vec_pretty(report)
        .map_err(|error| format!("cannot serialize the self-check report: {error}"))?;
    body.push(b'\n');
    fs::write(out, body).map_err(|error| format!("cannot write {}: {error}", out.display()))
}

/// Resolves the bundled paths from `config`, runs the check and writes it.
#[must_use]
pub fn run_and_write(config: &AppConfig, out: &Path) -> bool {
    let report = run(&Options {
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        snapshot_path: config.resolve_snapshot(),
        manifest_path: config.resolve_manifest(),
        home_dir: config.home_dir.clone(),
    });
    match write(&report, out) {
        Ok(()) => {
            for message in &report.errors {
                eprintln!("self-check: {message}");
            }
            report.ok
        }
        Err(error) => {
            eprintln!("self-check: {error}");
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::path::{Path, PathBuf};

    use sha2::{Digest, Sha256};

    use super::{Options, run, write};

    fn fixture() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../crates/indicators-core/tests/fixtures/mini.snapshot.sqlite")
    }

    fn sha256(path: &Path) -> String {
        let bytes = fs::read(path).unwrap();
        Sha256::digest(bytes)
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    fn manifest_for(directory: &Path, sha256: &str) -> PathBuf {
        let path = directory.join("MANIFEST.json");
        let body = serde_json::json!({
            "manifest_version": 1,
            "snapshot": { "schema_version": 1, "sha256": sha256 }
        });
        fs::write(&path, serde_json::to_vec(&body).unwrap()).unwrap();
        path
    }

    #[test]
    fn reports_ok_for_the_mini_fixture_and_a_matching_manifest() {
        let directory = tempfile::tempdir().unwrap();
        let snapshot = directory.path().join("snapshot.sqlite");
        fs::copy(fixture(), &snapshot).unwrap();
        let manifest = manifest_for(directory.path(), &sha256(&snapshot));

        let report = run(&Options {
            app_version: "0.1.0".to_string(),
            snapshot_path: snapshot,
            manifest_path: Some(manifest),
            home_dir: directory.path().join("home"),
        });

        assert!(report.ok, "errors: {:?}", report.errors);
        assert_eq!(report.app_version, "0.1.0");
        assert_eq!(report.snapshot.schema_version, 1);
        assert_eq!(report.snapshot.indicators, 6);
        assert_eq!(report.snapshot.geographies, 5);
        assert_eq!(report.snapshot.observations, 1_524);
        assert_eq!(report.snapshot.origin, "worldbank");
        assert!(report.snapshot.file_sha256_ok);
        assert!(report.user_store.ok);
        assert_eq!(report.user_store.schema_version, 1);
        assert!(report.errors.is_empty());
    }

    #[test]
    fn a_wrong_manifest_hash_fails_the_check() {
        let directory = tempfile::tempdir().unwrap();
        let snapshot = directory.path().join("snapshot.sqlite");
        fs::copy(fixture(), &snapshot).unwrap();
        let manifest = manifest_for(directory.path(), &"0".repeat(64));

        let report = run(&Options {
            app_version: "0.1.0".to_string(),
            snapshot_path: snapshot,
            manifest_path: Some(manifest),
            home_dir: directory.path().join("home"),
        });

        assert!(!report.ok);
        assert!(!report.snapshot.file_sha256_ok);
        assert!(
            report
                .errors
                .iter()
                .any(|message| message.contains("sha256 mismatch"))
        );
    }

    #[test]
    fn a_corrupt_snapshot_fails_without_panicking() {
        let directory = tempfile::tempdir().unwrap();
        let snapshot = directory.path().join("corrupt.sqlite");
        fs::write(&snapshot, b"not a snapshot").unwrap();
        let manifest = manifest_for(directory.path(), &sha256(&snapshot));

        let report = run(&Options {
            app_version: "0.1.0".to_string(),
            snapshot_path: snapshot,
            manifest_path: Some(manifest),
            home_dir: directory.path().join("home"),
        });

        assert!(!report.ok);
        assert_eq!(report.snapshot.indicators, 0);
        assert!(
            report
                .errors
                .iter()
                .any(|message| message.starts_with("snapshot:"))
        );
    }

    #[test]
    fn a_missing_manifest_is_reported_but_the_snapshot_counts_are_kept() {
        let directory = tempfile::tempdir().unwrap();
        let snapshot = directory.path().join("snapshot.sqlite");
        fs::copy(fixture(), &snapshot).unwrap();

        let report = run(&Options {
            app_version: "0.1.0".to_string(),
            snapshot_path: snapshot,
            manifest_path: None,
            home_dir: directory.path().join("home"),
        });

        assert!(!report.ok);
        assert_eq!(report.snapshot.indicators, 6);
        assert!(!report.snapshot.file_sha256_ok);
        assert!(
            report
                .errors
                .iter()
                .any(|message| message.contains("MANIFEST.json"))
        );
    }

    #[test]
    fn writing_the_report_creates_the_parent_directory_and_round_trips() {
        let directory = tempfile::tempdir().unwrap();
        let out = directory
            .path()
            .join("nested")
            .join("reports")
            .join("self-check.json");
        let report = super::SelfCheckReport {
            ok: true,
            app_version: "0.1.0".to_string(),
            snapshot: super::SnapshotReport {
                schema_version: 1,
                indicators: 38,
                geographies: 7,
                observations: 11_780,
                file_sha256_ok: true,
                origin: "worldbank".to_string(),
            },
            user_store: super::UserStoreReport {
                ok: true,
                schema_version: 1,
            },
            errors: Vec::new(),
        };

        write(&report, &out).unwrap();

        let raw = fs::read_to_string(&out).unwrap();
        assert!(raw.ends_with('\n'));
        let decoded: super::SelfCheckReport = serde_json::from_str(&raw).unwrap();
        assert_eq!(decoded, report);
        let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(value["snapshot"]["file_sha256_ok"], true);
        assert_eq!(value["user_store"]["schema_version"], 1);
    }
}
