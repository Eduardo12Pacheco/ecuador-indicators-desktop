#![forbid(unsafe_code)]

//! Tauri composition root for Ecuador Indicators.
//!
//! T5 wires the headless CLI, typed configuration and logging first; the
//! commands, self-check and window setup land in the following commits.

pub mod cli;
pub mod config;
pub mod logging;

/// Starts the desktop application.
pub fn run() {
    // Replaced by the full composition root later in T5.
}
