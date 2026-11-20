//! System clock and UUID generator adapters.

use std::time::{SystemTime, UNIX_EPOCH};

use uuid::Uuid;

use crate::ports::{Clock, IdGenerator};

/// Wall clock backed by the operating system.
pub struct SystemClock;

impl Clock for SystemClock {
    fn now_unix(&self) -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| i64::try_from(duration.as_secs()).unwrap_or(i64::MAX))
            .unwrap_or(0)
    }
}

/// UUID v4 generator used for saved-view ids and temporary export names.
pub struct UuidGenerator;

impl IdGenerator for UuidGenerator {
    fn new_id(&self) -> String {
        Uuid::new_v4().to_string()
    }
}
