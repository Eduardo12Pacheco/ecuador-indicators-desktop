//! Real-filesystem tests for the atomic export writer.

use std::fs;
use std::path::Path;

use indicators_core::adapters::fs_export::FsExportWriter;
use indicators_core::ports::ExportWriter;

#[test]
fn writes_the_content_and_leaves_no_temporary_file() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("export.csv");

    FsExportWriter.write(&path, b"a,b\r\n").unwrap();

    assert_eq!(fs::read(&path).unwrap(), b"a,b\r\n");
    let entries: Vec<_> = fs::read_dir(directory.path())
        .unwrap()
        .map(|entry| entry.unwrap().file_name())
        .collect();
    assert_eq!(entries, vec![std::ffi::OsString::from("export.csv")]);
}

#[test]
fn overwrites_an_existing_file() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("export.png");
    fs::write(&path, b"old").unwrap();

    FsExportWriter.write(&path, b"\x89PNG-new").unwrap();

    assert_eq!(fs::read(&path).unwrap(), b"\x89PNG-new");
}

#[test]
fn rejects_a_missing_parent_directory() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("missing").join("export.csv");

    let error = FsExportWriter.write(&path, b"x").unwrap_err();

    assert_eq!(error.code(), "EXPORT_REJECTED");
    assert!(error.to_string().contains("parent"));
}

#[test]
fn rejects_a_path_without_a_file_name() {
    let error = FsExportWriter.write(Path::new("/"), b"x").unwrap_err();

    assert_eq!(error.code(), "EXPORT_REJECTED");
}

#[test]
fn surfaces_io_failures_as_storage_errors() {
    let directory = tempfile::tempdir().unwrap();
    let read_only = directory.path().join("read-only");
    fs::create_dir(&read_only).unwrap();
    let mut permissions = fs::metadata(&read_only).unwrap().permissions();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        permissions.set_mode(0o500);
    }
    fs::set_permissions(&read_only, permissions).unwrap();

    let error = FsExportWriter
        .write(&read_only.join("export.csv"), b"x")
        .unwrap_err();

    assert_eq!(error.code(), "STORAGE");
}
