#![forbid(unsafe_code)]

//! Pure domain, ports and application services for Ecuador Indicators.
//! This crate has no Tauri dependency; adapters are added in T4.

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
