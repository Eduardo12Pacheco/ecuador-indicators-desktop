#![forbid(unsafe_code)]

//! Pure domain, ports and application services for Ecuador Indicators.
//!
//! Layering is enforced by `tests/architecture.rs`: `domain`, `ports` and
//! `application` never import SQLite, HTTP, filesystem or Tauri crates. The
//! `adapters` module implements those ports for the shipping application, and
//! its wire types generate the TypeScript bindings under
//! `src/adapters/tauri/generated`.

pub mod adapters;
pub mod application;
pub mod domain;
pub mod ports;

/// Returns the workspace version as a SemVer string.
#[must_use]
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::version;

    #[test]
    fn version_is_semver() {
        let parts: Vec<&str> = version().split('.').collect();
        assert_eq!(
            parts.len(),
            3,
            "expected MAJOR.MINOR.PATCH, got {}",
            version()
        );
        for part in parts {
            assert!(
                !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()),
                "non-numeric semver component in {}",
                version()
            );
        }
    }
}
