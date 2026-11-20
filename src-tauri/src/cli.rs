//! Command-line parsing for the desktop binary.
//!
//! The parser is pure so every branch is unit-testable without spawning a
//! process. `--self-check` never opens a window; unknown flags exit with code 2.

use std::fmt;
use std::path::PathBuf;

/// Usage line printed for invalid arguments.
pub const USAGE: &str = "usage: ecuador-indicators [--self-check --out <path>]";

/// What the binary should do for this invocation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Cli {
    /// Open the desktop application.
    Run,
    /// Write the S15 self-check JSON to `out` and exit without a window.
    SelfCheck { out: PathBuf },
}

/// A malformed command line.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CliError {
    message: String,
}

impl CliError {
    fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }

    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }
}

impl fmt::Display for CliError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for CliError {}

/// Parses arguments after the program name.
///
/// # Errors
/// Returns an error for unknown flags, a missing `--out` value, `--out`
/// without `--self-check`, or a duplicate `--out`.
pub fn parse_args<I>(args: I) -> Result<Cli, CliError>
where
    I: IntoIterator<Item = String>,
{
    let mut self_check = false;
    let mut out: Option<PathBuf> = None;
    let mut arguments = args.into_iter();

    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--self-check" => self_check = true,
            "--out" => {
                let value = arguments
                    .next()
                    .ok_or_else(|| CliError::new("--out requires a path after it"))?;
                if out.replace(PathBuf::from(value)).is_some() {
                    return Err(CliError::new("--out can only be provided once"));
                }
            }
            other => {
                return Err(CliError::new(format!("unknown argument {other:?}")));
            }
        }
    }

    match (self_check, out) {
        (true, Some(out)) => Ok(Cli::SelfCheck { out }),
        (true, None) => Err(CliError::new("--self-check requires --out <path>")),
        (false, Some(_)) => Err(CliError::new("--out is only valid with --self-check")),
        (false, None) => Ok(Cli::Run),
    }
}

#[cfg(test)]
mod tests {
    use super::{Cli, parse_args};
    use std::path::PathBuf;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(ToString::to_string).collect()
    }

    #[test]
    fn no_arguments_opens_the_app() {
        assert_eq!(parse_args(args(&[])), Ok(Cli::Run));
    }

    #[test]
    fn self_check_requires_an_output_path() {
        assert_eq!(
            parse_args(args(&["--self-check", "--out", "/tmp/report.json"])),
            Ok(Cli::SelfCheck {
                out: PathBuf::from("/tmp/report.json")
            })
        );
    }

    #[test]
    fn self_check_without_out_is_an_error() {
        let error = parse_args(args(&["--self-check"])).unwrap_err();
        assert!(error.message().contains("--out"));
    }

    #[test]
    fn out_without_self_check_is_an_error() {
        let error = parse_args(args(&["--out", "/tmp/report.json"])).unwrap_err();
        assert!(error.message().contains("--self-check"));
    }

    #[test]
    fn out_without_a_value_is_an_error() {
        let error = parse_args(args(&["--self-check", "--out"])).unwrap_err();
        assert!(error.message().contains("requires a path"));
    }

    #[test]
    fn duplicate_out_is_an_error() {
        let error = parse_args(args(&[
            "--self-check",
            "--out",
            "a.json",
            "--out",
            "b.json",
        ]))
        .unwrap_err();
        assert!(error.message().contains("once"));
    }

    #[test]
    fn unknown_flags_are_rejected() {
        let error = parse_args(args(&["--bogus"])).unwrap_err();
        assert!(error.message().contains("unknown argument"));
        assert!(error.message().contains("--bogus"));
    }
}
