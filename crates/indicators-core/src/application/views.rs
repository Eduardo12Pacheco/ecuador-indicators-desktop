//! Saved-view use cases and the authoritative view-spec validation (D25).

use std::sync::Arc;

use crate::domain::{CoreError, NewView, SavedView, ViewSpec};
use crate::ports::{Clock, IdGenerator, UserStore};

/// Maximum number of saved views (S6).
pub const MAX_VIEWS: usize = 200;
/// Maximum saved-view name length in characters (S6).
pub const MAX_NAME_CHARS: usize = 80;
/// Minimum and maximum accepted years for every view range.
pub const MIN_YEAR: i32 = 1900;
pub const MAX_YEAR: i32 = 2100;

fn is_iso3(value: &str) -> bool {
    value.len() == 3 && value.bytes().all(|byte| byte.is_ascii_uppercase())
}

fn check_year(value: i32, field: &str) -> Result<(), CoreError> {
    if (MIN_YEAR..=MAX_YEAR).contains(&value) {
        Ok(())
    } else {
        Err(CoreError::view_invalid(format!(
            "{field} must be between {MIN_YEAR} and {MAX_YEAR}, got {value}"
        )))
    }
}

fn check_indicator(value: &str, field: &str) -> Result<(), CoreError> {
    if value.trim().is_empty() {
        Err(CoreError::view_invalid(format!(
            "{field} must not be empty"
        )))
    } else {
        Ok(())
    }
}

fn check_unique(values: &[String], field: &str) -> Result<(), CoreError> {
    for (index, value) in values.iter().enumerate() {
        if values[index + 1..].contains(value) {
            return Err(CoreError::view_invalid(format!(
                "{field} must be unique, duplicate {value:?}"
            )));
        }
    }
    Ok(())
}

fn validate_explore(
    indicator: &str,
    geographies: &[String],
    from: Option<i32>,
    to: Option<i32>,
    base_year: Option<i32>,
) -> Result<(), CoreError> {
    check_indicator(indicator, "indicator")?;
    if !(1..=5).contains(&geographies.len()) {
        return Err(CoreError::view_invalid(format!(
            "explore geographies must contain 1 to 5 entries, got {}",
            geographies.len()
        )));
    }
    if geographies[0] != "ECU" {
        return Err(CoreError::view_invalid(
            "the first explore geography must be ECU",
        ));
    }
    for geography in geographies {
        if !is_iso3(geography) {
            return Err(CoreError::view_invalid(format!(
                "geographies must be uppercase ISO3 codes, got {geography:?}"
            )));
        }
    }
    check_unique(geographies, "geographies")?;
    if let Some(from) = from {
        check_year(from, "from")?;
    }
    if let Some(to) = to {
        check_year(to, "to")?;
    }
    if let (Some(from), Some(to)) = (from, to)
        && from > to
    {
        return Err(CoreError::view_invalid(format!(
            "from ({from}) must not be after to ({to})"
        )));
    }
    if let Some(base_year) = base_year {
        check_year(base_year, "base_year")?;
    }
    Ok(())
}

fn validate_trajectories(
    indicators: &[String],
    geography: &str,
    base_year: Option<i32>,
) -> Result<(), CoreError> {
    if !(2..=4).contains(&indicators.len()) {
        return Err(CoreError::view_invalid(format!(
            "trajectories must contain 2 to 4 indicators, got {}",
            indicators.len()
        )));
    }
    for indicator in indicators {
        check_indicator(indicator, "indicator")?;
    }
    check_unique(indicators, "indicators")?;
    if !is_iso3(geography) {
        return Err(CoreError::view_invalid(format!(
            "geography must be an uppercase ISO3 code, got {geography:?}"
        )));
    }
    if let Some(base_year) = base_year {
        check_year(base_year, "base_year")?;
    }
    Ok(())
}

fn validate_ranking(indicator: &str, year: i32) -> Result<(), CoreError> {
    check_indicator(indicator, "indicator")?;
    check_year(year, "year")
}

/// Validates a view spec. This is the authoritative implementation; the
/// TypeScript adapter mirrors it for fast UI feedback.
///
/// # Errors
/// Returns `VIEW_INVALID` with a human-readable message.
pub fn validate_view_spec(spec: &ViewSpec) -> Result<(), CoreError> {
    match spec {
        ViewSpec::Explore {
            indicator,
            geographies,
            from,
            to,
            transform: _,
            base_year,
            chart: _,
        } => validate_explore(indicator, geographies, *from, *to, *base_year),
        ViewSpec::Trajectories {
            indicators,
            geography,
            base_year,
        } => validate_trajectories(indicators, geography, *base_year),
        ViewSpec::Ranking { indicator, year } => validate_ranking(indicator, *year),
    }
}

/// Validates a name: trimmed length between 1 and 80 characters (S6).
///
/// # Errors
/// Returns `VIEW_INVALID`.
pub fn validate_view_name(name: &str) -> Result<(), CoreError> {
    let trimmed = name.trim();
    let length = trimmed.chars().count();
    if length == 0 || length > MAX_NAME_CHARS {
        return Err(CoreError::view_invalid(format!(
            "name must contain 1 to {MAX_NAME_CHARS} characters, got {length}"
        )));
    }
    Ok(())
}

/// Saved-view CRUD with validation, limits and deterministic timestamps.
pub struct ViewService {
    store: Arc<dyn UserStore>,
    clock: Arc<dyn Clock>,
    ids: Arc<dyn IdGenerator>,
}

impl ViewService {
    #[must_use]
    pub fn new(
        store: Arc<dyn UserStore>,
        clock: Arc<dyn Clock>,
        ids: Arc<dyn IdGenerator>,
    ) -> Self {
        Self { store, clock, ids }
    }

    /// # Errors
    /// Propagates store errors.
    pub fn list_views(&self) -> Result<Vec<SavedView>, CoreError> {
        self.store.list_views()
    }

    /// # Errors
    /// Returns `VIEW_NOT_FOUND` when the id does not exist.
    pub fn get_view(&self, id: &str) -> Result<SavedView, CoreError> {
        self.store
            .get_view(id)?
            .ok_or_else(|| CoreError::view_not_found(id))
    }

    /// # Errors
    /// `VIEW_INVALID` for bad input, `LIMIT_EXCEEDED` above 200 views, and
    /// `STORAGE` for persistence failures.
    pub fn create_view(&self, new_view: NewView) -> Result<SavedView, CoreError> {
        validate_view_name(&new_view.name)?;
        validate_view_spec(&new_view.spec)?;
        if self.store.count_views()? >= MAX_VIEWS {
            return Err(CoreError::limit_exceeded(format!(
                "at most {MAX_VIEWS} saved views are allowed"
            )));
        }
        let now = self.clock.now_unix();
        let view = SavedView {
            id: self.ids.new_id(),
            name: new_view.name.trim().to_string(),
            spec: new_view.spec,
            created_at: now,
            updated_at: now,
        };
        self.store.insert_view(&view)?;
        Ok(view)
    }

    /// # Errors
    /// `VIEW_NOT_FOUND`, `VIEW_INVALID` or `STORAGE`.
    pub fn update_view(&self, id: &str, new_view: NewView) -> Result<SavedView, CoreError> {
        let existing = self.get_view(id)?;
        validate_view_name(&new_view.name)?;
        validate_view_spec(&new_view.spec)?;
        let view = SavedView {
            id: existing.id,
            name: new_view.name.trim().to_string(),
            spec: new_view.spec,
            created_at: existing.created_at,
            updated_at: self.clock.now_unix(),
        };
        self.store.update_view(&view)?;
        Ok(view)
    }

    /// # Errors
    /// `VIEW_NOT_FOUND` or `STORAGE`.
    pub fn delete_view(&self, id: &str) -> Result<(), CoreError> {
        if self.store.delete_view(id)? {
            Ok(())
        } else {
            Err(CoreError::view_not_found(id))
        }
    }

    /// # Errors
    /// Propagates store errors.
    pub fn count_views(&self) -> Result<usize, CoreError> {
        self.store.count_views()
    }
}
