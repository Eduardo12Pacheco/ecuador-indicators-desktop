//! Filesystem export writer: writes a sibling temporary file and renames it.

use std::fs::{self, File};
use std::io::Write;
use std::path::Path;

use uuid::Uuid;

use crate::domain::CoreError;
use crate::ports::ExportWriter;

/// Writes exports atomically inside an existing parent directory.
pub struct FsExportWriter;

impl ExportWriter for FsExportWriter {
    fn write(&self, path: &Path, bytes: &[u8]) -> Result<(), CoreError> {
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.is_empty())
            .ok_or_else(|| {
                CoreError::export_rejected("the destination must include a file name")
            })?;
        let parent = path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .unwrap_or_else(|| Path::new("."));
        if !parent.is_dir() {
            return Err(CoreError::export_rejected(format!(
                "the parent directory {} does not exist",
                parent.display()
            )));
        }
        let temporary = parent.join(format!(".{file_name}.tmp-{}", Uuid::new_v4()));
        let result = (|| -> std::io::Result<()> {
            let mut file = File::create(&temporary)?;
            file.write_all(bytes)?;
            file.sync_all()?;
            drop(file);
            // On Unix rename replaces an existing destination atomically. On
            // Windows it fails when the destination exists, so remove and
            // retry in that one case.
            match fs::rename(&temporary, path) {
                Ok(()) => Ok(()),
                Err(_error) if path.exists() => {
                    fs::remove_file(path)?;
                    fs::rename(&temporary, path)
                }
                Err(error) => Err(error),
            }
        })();
        if let Err(error) = result {
            let _ = fs::remove_file(&temporary);
            return Err(CoreError::storage(format!(
                "failed to write {}: {error}",
                path.display()
            )));
        }
        Ok(())
    }
}
