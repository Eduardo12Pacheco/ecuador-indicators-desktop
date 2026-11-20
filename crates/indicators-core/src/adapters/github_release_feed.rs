//! GitHub "latest release" feed adapter (D17).

use std::sync::Arc;

use crate::domain::{CoreError, ReleaseInfo};
use crate::ports::{HttpGet, ReleaseFeed};

/// Reads the latest published release from the configured JSON endpoint.
pub struct GithubReleaseFeed {
    http: Arc<dyn HttpGet>,
    url: String,
}

impl GithubReleaseFeed {
    #[must_use]
    pub fn new(http: Arc<dyn HttpGet>, url: impl Into<String>) -> Self {
        Self {
            http,
            url: url.into(),
        }
    }
}

impl ReleaseFeed for GithubReleaseFeed {
    fn latest(&self) -> Result<ReleaseInfo, CoreError> {
        let body = self.http.get(&self.url)?;
        let release: ReleaseInfo = serde_json::from_str(&body).map_err(|error| {
            CoreError::update_feed(format!("invalid release feed response: {error}"))
        })?;
        if release.tag_name.trim().is_empty() {
            return Err(CoreError::update_feed(
                "release feed returned an empty tag_name",
            ));
        }
        if release.html_url.trim().is_empty() {
            return Err(CoreError::update_feed(
                "release feed returned an empty html_url",
            ));
        }
        Ok(release)
    }
}
