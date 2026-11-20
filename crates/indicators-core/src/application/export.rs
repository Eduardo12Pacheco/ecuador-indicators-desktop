//! Export-path validation and atomic write delegation (S7).

use std::path::Path;
use std::sync::Arc;

use crate::domain::CoreError;
use crate::ports::ExportWriter;

/// Maximum accepted export payload (50 MiB).
pub const MAX_EXPORT_BYTES: usize = 50 * 1024 * 1024;

/// Validates the destination and delegates to the [`ExportWriter`] adapter.
pub struct ExportService {
    writer: Arc<dyn ExportWriter>,
}

impl ExportService {
    #[must_use]
    pub fn new(writer: Arc<dyn ExportWriter>) -> Self {
        Self { writer }
    }

    /// Accepts only `.csv` and `.png` destinations (case-insensitive) with a
    /// real file name and at most 50 MiB of content.
    ///
    /// # Errors
    /// `EXPORT_REJECTED` for a bad path or oversized payload; `STORAGE` when the
    /// writer fails.
    pub fn save(&self, path: &Path, content: &[u8]) -> Result<(), CoreError> {
        let file_name = path
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|name| !name.is_empty())
            .ok_or_else(|| {
                CoreError::export_rejected("the destination must include a file name")
            })?;
        let extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .map(str::to_ascii_lowercase);
        if !matches!(extension.as_deref(), Some("csv" | "png")) {
            return Err(CoreError::export_rejected(format!(
                "only .csv and .png files can be exported, got {file_name:?}"
            )));
        }
        if content.len() > MAX_EXPORT_BYTES {
            return Err(CoreError::export_rejected(format!(
                "export content must be at most 50 MiB, got {} bytes",
                content.len()
            )));
        }
        self.writer.write(path, content)
    }
}
