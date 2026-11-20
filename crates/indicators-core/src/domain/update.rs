//! Update-check contracts (D17): notify-only, semver comparison, no updater.

use semver::Version;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::domain::error::CoreError;

/// One release as returned by the GitHub "latest release" endpoint.
#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub html_url: String,
    #[serde(default)]
    pub published_at: Option<String>,
    #[serde(default)]
    pub draft: bool,
    #[serde(default)]
    pub prerelease: bool,
}

/// Result of one update check, rendered by the Settings page.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(tag = "kind", rename_all = "snake_case")]
#[ts(export)]
pub enum UpdateStatus {
    UpToDate {
        current: String,
    },
    Available {
        current: String,
        latest: String,
        url: String,
        published_at: Option<String>,
    },
    Disabled {
        current: String,
    },
}

impl UpdateStatus {
    #[must_use]
    pub fn up_to_date(current: impl Into<String>) -> Self {
        Self::UpToDate {
            current: current.into(),
        }
    }

    #[must_use]
    pub fn disabled(current: impl Into<String>) -> Self {
        Self::Disabled {
            current: current.into(),
        }
    }
}

/// Strips one leading `v` or `V` and parses a strict SemVer version.
///
/// # Errors
/// Returns `INTERNAL` for the running app version and `UPDATE_FEED` for the
/// candidate version, so a malformed feed never looks like an app bug.
pub fn parse_version(value: &str, from_feed: bool) -> Result<Version, CoreError> {
    let trimmed = value
        .trim()
        .strip_prefix('v')
        .or_else(|| value.trim().strip_prefix('V'))
        .unwrap_or_else(|| value.trim());
    Version::parse(trimmed).map_err(|error| {
        if from_feed {
            CoreError::update_feed(format!("invalid release version {value:?}: {error}"))
        } else {
            CoreError::internal(format!("invalid application version {value:?}: {error}"))
        }
    })
}

/// Returns whether `candidate` is strictly newer than `current`.
///
/// Both arguments accept a leading `v`/`V`.
///
/// # Errors
/// See [`parse_version`].
pub fn is_newer(current: &str, candidate: &str) -> Result<bool, CoreError> {
    Ok(parse_version(candidate, true)? > parse_version(current, false)?)
}
