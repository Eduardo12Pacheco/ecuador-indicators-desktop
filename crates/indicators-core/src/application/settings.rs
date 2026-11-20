//! Typed settings use cases over the `setting` key/value table (D16).

use std::sync::Arc;

use crate::domain::{CoreError, LangPref, Settings, ThemePref};
use crate::ports::UserStore;

pub const KEY_THEME: &str = "theme";
pub const KEY_LANGUAGE: &str = "language";
pub const KEY_UPDATE_CHECK_ENABLED: &str = "update_check_enabled";
pub const KEY_LAST_UPDATE_CHECK: &str = "last_update_check";
pub const KEY_CUSTOM_SNAPSHOT_PATH: &str = "custom_snapshot_path";

fn parse_theme(value: Option<&str>) -> ThemePref {
    match value {
        Some("light") => ThemePref::Light,
        Some("dark") => ThemePref::Dark,
        _ => ThemePref::System,
    }
}

fn parse_language(value: Option<&str>) -> LangPref {
    match value {
        Some("en") => LangPref::En,
        Some("es") => LangPref::Es,
        _ => LangPref::System,
    }
}

fn parse_bool(value: Option<&str>) -> bool {
    matches!(value, Some("true"))
}

fn parse_timestamp(value: Option<&str>) -> Option<i64> {
    value.and_then(|raw| raw.parse::<i64>().ok())
}

fn parse_path(value: Option<&str>) -> Option<String> {
    value
        .filter(|raw| !raw.trim().is_empty())
        .map(ToString::to_string)
}

/// Reads and writes the typed settings document.
///
/// Unknown or corrupt stored values fall back to the documented defaults so a
/// damaged row cannot brick the Settings page; valid values round-trip exactly.
pub struct SettingsService {
    store: Arc<dyn UserStore>,
}

impl SettingsService {
    #[must_use]
    pub fn new(store: Arc<dyn UserStore>) -> Self {
        Self { store }
    }

    /// # Errors
    /// Propagates store errors.
    pub fn get(&self) -> Result<Settings, CoreError> {
        Ok(Settings {
            theme: parse_theme(self.store.get_setting(KEY_THEME)?.as_deref()),
            language: parse_language(self.store.get_setting(KEY_LANGUAGE)?.as_deref()),
            update_check_enabled: parse_bool(
                self.store.get_setting(KEY_UPDATE_CHECK_ENABLED)?.as_deref(),
            ),
            last_update_check: parse_timestamp(
                self.store.get_setting(KEY_LAST_UPDATE_CHECK)?.as_deref(),
            ),
            custom_snapshot_path: parse_path(
                self.store.get_setting(KEY_CUSTOM_SNAPSHOT_PATH)?.as_deref(),
            ),
        })
    }

    /// # Errors
    /// Propagates store errors.
    pub fn set(&self, settings: &Settings) -> Result<(), CoreError> {
        let theme = match settings.theme {
            ThemePref::System => "system",
            ThemePref::Light => "light",
            ThemePref::Dark => "dark",
        };
        let language = match settings.language {
            LangPref::System => "system",
            LangPref::En => "en",
            LangPref::Es => "es",
        };
        self.store.set_setting(KEY_THEME, theme)?;
        self.store.set_setting(KEY_LANGUAGE, language)?;
        self.store.set_setting(
            KEY_UPDATE_CHECK_ENABLED,
            if settings.update_check_enabled {
                "true"
            } else {
                "false"
            },
        )?;
        self.store.set_setting(
            KEY_LAST_UPDATE_CHECK,
            &settings
                .last_update_check
                .map(|value| value.to_string())
                .unwrap_or_default(),
        )?;
        self.store.set_setting(
            KEY_CUSTOM_SNAPSHOT_PATH,
            settings.custom_snapshot_path.as_deref().unwrap_or(""),
        )?;
        Ok(())
    }
}
