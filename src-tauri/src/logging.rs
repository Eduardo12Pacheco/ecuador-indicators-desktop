//! Structured logging to stderr and a daily rolling file (S17).
//!
//! The subscriber is built after the typed configuration so the log directory
//! and level are the documented environment values. `--self-check` initializes
//! the same logging before it writes its report.

use std::fs;

use tracing_subscriber::EnvFilter;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;

use crate::config::AppConfig;

/// Keeps the non-blocking file writer alive for the process lifetime.
pub struct LogGuard {
    _worker: tracing_appender::non_blocking::WorkerGuard,
}

/// Initializes tracing. A failure to create the log directory is reported but
/// never prevents the app or self-check from running.
///
/// # Errors
/// Returns a message when the log directory cannot be created.
pub fn init(config: &AppConfig) -> Result<LogGuard, String> {
    if let Err(error) = fs::create_dir_all(&config.log_dir) {
        return Err(format!(
            "cannot create the log directory {}: {error}",
            config.log_dir.display()
        ));
    }
    let filter = EnvFilter::try_new(&config.log_level).unwrap_or_else(|_| EnvFilter::new("info"));
    let appender = tracing_appender::rolling::daily(&config.log_dir, "ecuador-indicators.log");
    let (file_writer, worker) = tracing_appender::non_blocking(appender);
    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(tracing_subscriber::fmt::layer().with_writer(std::io::stderr))
        .with(
            tracing_subscriber::fmt::layer()
                .with_ansi(false)
                .with_writer(file_writer),
        )
        .try_init();
    Ok(LogGuard { _worker: worker })
}
