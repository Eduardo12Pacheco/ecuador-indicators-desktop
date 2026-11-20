//! Architecture tests (S23): the pure layers must not reach for I/O crates.
//!
//! RED evidence for this test is recorded in the plan Log: adding
//! `use rusqlite::Connection;` to a domain file makes it fail.

use std::fs;
use std::path::{Path, PathBuf};

fn rust_sources(directory: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut pending = vec![directory.to_path_buf()];
    while let Some(current) = pending.pop() {
        for entry in fs::read_dir(&current).expect("source directory must be readable") {
            let entry = entry.expect("source entry must be readable");
            let path = entry.path();
            if path.is_dir() {
                pending.push(path);
            } else if path.extension().is_some_and(|extension| extension == "rs") {
                files.push(path);
            }
        }
    }
    files.sort();
    files
}

fn assert_layer_is_pure(directory: &Path, forbidden: &[&str]) {
    for file in rust_sources(directory) {
        let content = fs::read_to_string(&file).expect("source file must be readable");
        for token in forbidden {
            assert!(
                !content.contains(token),
                "{} must not reference {token:?} (found in {})",
                file.display(),
                file.display()
            );
        }
    }
}

#[test]
fn domain_ports_and_application_do_not_import_io_crates() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let forbidden = [
        "rusqlite", "ureq", "std::fs", "std::net", "std::env", "tauri", "sha2",
    ];
    for layer in ["domain", "application"] {
        assert_layer_is_pure(&src.join(layer), &forbidden);
    }
    let ports = fs::read_to_string(src.join("ports.rs")).unwrap();
    for token in forbidden {
        assert!(
            !ports.contains(token),
            "ports.rs must not reference {token:?}"
        );
    }
}

#[test]
fn the_crate_manifest_has_no_tauri_dependency() {
    let manifest = fs::read_to_string(Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml"))
        .expect("Cargo.toml must be readable");
    for line in manifest.lines() {
        let name = line.split(['=', ' ']).next().unwrap_or_default().trim();
        assert!(
            !name.starts_with("tauri"),
            "indicators-core must not depend on a tauri crate, found {line:?}"
        );
    }
}

#[test]
fn only_adapters_may_reference_ureq() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    for file in rust_sources(&src) {
        let content = fs::read_to_string(&file).unwrap();
        if content.contains("ureq") {
            assert!(
                file.starts_with(src.join("adapters")),
                "ureq must only appear under adapters/, found in {}",
                file.display()
            );
        }
    }
}

#[test]
fn the_public_surface_stays_available_for_the_shell() {
    // Compile-time guard: the Tauri composition root imports these names, so a
    // rename in the core breaks here before it breaks the shell.
    use indicators_core::adapters::fs_export::FsExportWriter;
    use indicators_core::adapters::github_release_feed::GithubReleaseFeed;
    use indicators_core::adapters::http::UreqHttpGet;
    use indicators_core::adapters::sqlite_snapshot::{SqliteSnapshotOpener, SqliteSnapshotReader};
    use indicators_core::adapters::sqlite_user_store::SqliteUserStore;
    use indicators_core::adapters::system::{SystemClock, UuidGenerator};
    use indicators_core::application::{
        DatasetService, ExportService, SettingsService, UpdateService, ViewService,
    };
    let _ = (
        FsExportWriter,
        SystemClock,
        UuidGenerator,
        std::mem::size_of::<SqliteSnapshotReader>(),
        std::mem::size_of::<SqliteSnapshotOpener>,
        std::mem::size_of::<SqliteUserStore>(),
        std::mem::size_of::<GithubReleaseFeed>(),
        std::mem::size_of::<UreqHttpGet>(),
        std::mem::size_of::<DatasetService>(),
        std::mem::size_of::<ViewService>(),
        std::mem::size_of::<SettingsService>(),
        std::mem::size_of::<ExportService>(),
        std::mem::size_of::<UpdateService>(),
    );
}
