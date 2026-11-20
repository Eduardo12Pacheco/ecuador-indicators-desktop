//! HTTP GET adapter over `ureq` with a finite global timeout.
//!
//! This is the only module in the core that opens a socket (S1/S34); the
//! architecture test pins that boundary.

use std::time::Duration;

use crate::domain::CoreError;
use crate::ports::HttpGet;

/// `ureq`-backed HTTP client with a descriptive User-Agent.
pub struct UreqHttpGet {
    agent: ureq::Agent,
    user_agent: String,
}

impl UreqHttpGet {
    #[must_use]
    pub fn new(user_agent: impl Into<String>, timeout: Duration) -> Self {
        let config = ureq::Agent::config_builder()
            .timeout_global(Some(timeout))
            .build();
        Self {
            agent: config.new_agent(),
            user_agent: user_agent.into(),
        }
    }
}

impl HttpGet for UreqHttpGet {
    fn get(&self, url: &str) -> Result<String, CoreError> {
        let mut response = self
            .agent
            .get(url)
            .header("User-Agent", &self.user_agent)
            .header("Accept", "application/vnd.github+json")
            .call()
            .map_err(|error| CoreError::network(format!("GET {url} failed: {error}")))?;
        response
            .body_mut()
            .read_to_string()
            .map_err(|error| CoreError::network(format!("GET {url} body failed: {error}")))
    }
}
