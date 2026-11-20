//! Explicit error types with the stable IPC codes from D24.

use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

/// Errors produced by the core. Each variant maps to one stable IPC code.
#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CoreError {
    #[error("snapshot is invalid: {message}")]
    SnapshotInvalid { message: String },

    #[error("snapshot not found: {path}")]
    SnapshotNotFound { path: String },

    #[error("view not found: {id}")]
    ViewNotFound { id: String },

    #[error("view is invalid: {message}")]
    ViewInvalid { message: String },

    #[error("limit exceeded: {message}")]
    LimitExceeded { message: String },

    #[error("storage error: {message}")]
    Storage { message: String },

    #[error("export rejected: {message}")]
    ExportRejected { message: String },

    #[error("update feed error: {message}")]
    UpdateFeed { message: String },

    #[error("network error: {message}")]
    Network { message: String },

    #[error("internal error: {message}")]
    Internal { message: String },
}

impl CoreError {
    /// Stable error code exposed to the UI.
    #[must_use]
    pub fn code(&self) -> &'static str {
        match self {
            Self::SnapshotInvalid { .. } => "SNAPSHOT_INVALID",
            Self::SnapshotNotFound { .. } => "SNAPSHOT_NOT_FOUND",
            Self::ViewNotFound { .. } => "VIEW_NOT_FOUND",
            Self::ViewInvalid { .. } => "VIEW_INVALID",
            Self::LimitExceeded { .. } => "LIMIT_EXCEEDED",
            Self::Storage { .. } => "STORAGE",
            Self::ExportRejected { .. } => "EXPORT_REJECTED",
            Self::UpdateFeed { .. } => "UPDATE_FEED",
            Self::Network { .. } => "NETWORK",
            Self::Internal { .. } => "INTERNAL",
        }
    }

    #[must_use]
    pub fn snapshot_invalid(message: impl Into<String>) -> Self {
        Self::SnapshotInvalid {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn snapshot_not_found(path: impl Into<String>) -> Self {
        Self::SnapshotNotFound { path: path.into() }
    }

    #[must_use]
    pub fn view_not_found(id: impl Into<String>) -> Self {
        Self::ViewNotFound { id: id.into() }
    }

    #[must_use]
    pub fn view_invalid(message: impl Into<String>) -> Self {
        Self::ViewInvalid {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn limit_exceeded(message: impl Into<String>) -> Self {
        Self::LimitExceeded {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn storage(message: impl Into<String>) -> Self {
        Self::Storage {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn export_rejected(message: impl Into<String>) -> Self {
        Self::ExportRejected {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn update_feed(message: impl Into<String>) -> Self {
        Self::UpdateFeed {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn network(message: impl Into<String>) -> Self {
        Self::Network {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }
}

/// The error shape sent across the Tauri IPC boundary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct ErrorDto {
    pub code: String,
    pub message: String,
}

impl From<&CoreError> for ErrorDto {
    fn from(error: &CoreError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

impl From<CoreError> for ErrorDto {
    fn from(error: CoreError) -> Self {
        Self::from(&error)
    }
}
