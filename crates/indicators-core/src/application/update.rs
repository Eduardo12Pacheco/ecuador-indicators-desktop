//! Notify-only update checks (D17): opt-in, throttled, never downloads.

use std::sync::Arc;

use crate::application::SettingsService;
use crate::domain::{CoreError, UpdateStatus, is_newer, parse_version};
use crate::ports::{Clock, ReleaseFeed};

/// Minimum interval between non-forced checks (24 hours).
pub const CHECK_INTERVAL_SECONDS: i64 = 24 * 60 * 60;

/// Checks the release feed when enabled or explicitly forced.
pub struct UpdateService {
    feed: Arc<dyn ReleaseFeed>,
    settings: Arc<SettingsService>,
    clock: Arc<dyn Clock>,
}

impl UpdateService {
    #[must_use]
    pub fn new(
        feed: Arc<dyn ReleaseFeed>,
        settings: Arc<SettingsService>,
        clock: Arc<dyn Clock>,
    ) -> Self {
        Self {
            feed,
            settings,
            clock,
        }
    }

    /// Runs one update check.
    ///
    /// `force` (the "Check now" button) bypasses both the opt-in setting and
    /// the 24-hour throttle. A disabled or throttled check returns
    /// [`UpdateStatus::Disabled`] without touching the network. The throttle
    /// timestamp is persisted only after a successful feed read, so a network
    /// failure can be retried immediately; draft and prerelease releases count
    /// as "no update".
    ///
    /// # Errors
    /// `NETWORK`, `UPDATE_FEED`, `STORAGE` or `INTERNAL` according to the port
    /// that failed.
    pub fn check(&self, current_version: &str, force: bool) -> Result<UpdateStatus, CoreError> {
        let mut settings = self.settings.get()?;
        if !settings.update_check_enabled && !force {
            return Ok(UpdateStatus::disabled(current_version));
        }
        let now = self.clock.now_unix();
        if !force
            && settings
                .last_update_check
                .is_some_and(|last| now.saturating_sub(last) < CHECK_INTERVAL_SECONDS)
        {
            return Ok(UpdateStatus::disabled(current_version));
        }

        let release = self.feed.latest()?;
        settings.last_update_check = Some(now);
        self.settings.set(&settings)?;

        if release.draft || release.prerelease || !is_newer(current_version, &release.tag_name)? {
            return Ok(UpdateStatus::up_to_date(current_version));
        }
        let latest = parse_version(&release.tag_name, true)?.to_string();
        Ok(UpdateStatus::Available {
            current: current_version.to_string(),
            latest,
            url: release.html_url,
            published_at: release.published_at,
        })
    }
}
