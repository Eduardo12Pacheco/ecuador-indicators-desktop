//! Typed application settings persisted in `user.db` (D16).

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Theme preference. `System` follows the OS.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum ThemePref {
    System,
    Light,
    Dark,
}

/// Language preference. `System` follows the OS locale.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum LangPref {
    System,
    En,
    Es,
}

/// The complete settings document exposed over IPC.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Settings {
    pub theme: ThemePref,
    pub language: LangPref,
    pub update_check_enabled: bool,
    /// Unix timestamp (seconds) of the last successful update check.
    pub last_update_check: Option<i64>,
    pub custom_snapshot_path: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: ThemePref::System,
            language: LangPref::System,
            update_check_enabled: false,
            last_update_check: None,
            custom_snapshot_path: None,
        }
    }
}
