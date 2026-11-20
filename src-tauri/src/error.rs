//! Tauri command error boundary.
//!
//! Every command returns `Result<T, ErrorDto>`; the DTO carries the stable D24
//! code so the TypeScript adapter can map it to an `AppError` without parsing
//! prose.

use indicators_core::domain::{CoreError, ErrorDto};

/// Converts a core error into the wire shape.
#[must_use]
pub fn to_dto(error: &CoreError) -> ErrorDto {
    ErrorDto::from(error)
}

/// Builds an `INTERNAL` error DTO for shell failures that are not core errors.
#[must_use]
pub fn internal(message: impl Into<String>) -> ErrorDto {
    to_dto(&CoreError::internal(message))
}
