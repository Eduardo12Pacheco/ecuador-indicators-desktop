//! Adapters implementing the core ports (SQLite, filesystem, HTTP, system).

pub mod fs_export;
pub mod github_release_feed;
pub mod http;
pub mod sqlite_snapshot;
pub mod sqlite_user_store;
pub mod system;
