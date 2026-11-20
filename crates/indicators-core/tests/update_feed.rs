//! Recorded-fixture tests for the GitHub release feed adapter.
//!
//! A local httpmock server stands in for the GitHub API: no test touches the
//! network, and the recorded JSON mirrors the fields the adapter consumes.

use std::path::Path;
use std::sync::Arc;
use std::time::Duration;

use httpmock::prelude::*;
use indicators_core::adapters::github_release_feed::GithubReleaseFeed;
use indicators_core::adapters::http::UreqHttpGet;
use indicators_core::ports::ReleaseFeed;

fn fixture() -> String {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests/fixtures/github_latest_release.json")
        .to_string_lossy()
        .into_owned()
}

fn feed(server: &MockServer, timeout: Duration) -> GithubReleaseFeed {
    GithubReleaseFeed::new(
        Arc::new(UreqHttpGet::new("ecuador-indicators/0.1.0", timeout)),
        format!("{}/releases/latest", server.base_url()),
    )
}

#[test]
fn parses_the_recorded_latest_release_fixture() {
    let server = MockServer::start();
    let mock = server.mock(|when, then| {
        when.method(GET)
            .path("/releases/latest")
            .header("user-agent", "ecuador-indicators/0.1.0");
        then.status(200)
            .header("content-type", "application/json")
            .body_from_file(fixture());
    });

    let release = feed(&server, Duration::from_secs(2)).latest().unwrap();

    assert_eq!(release.tag_name, "v0.2.0");
    assert_eq!(
        release.html_url,
        "https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/releases/tag/v0.2.0"
    );
    assert_eq!(
        release.published_at.as_deref(),
        Some("2026-12-01T10:00:00Z")
    );
    assert!(!release.draft);
    assert!(!release.prerelease);
    mock.assert();
}

#[test]
fn maps_a_missing_release_to_a_network_error() {
    let server = MockServer::start();
    let mock = server.mock(|when, then| {
        when.method(GET).path("/releases/latest");
        then.status(404).body("Not Found");
    });

    let error = feed(&server, Duration::from_secs(2)).latest().unwrap_err();

    assert_eq!(error.code(), "NETWORK");
    mock.assert();
}

#[test]
fn maps_invalid_json_to_an_update_feed_error() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/releases/latest");
        then.status(200)
            .header("content-type", "application/json")
            .body("{not json");
    });

    let error = feed(&server, Duration::from_secs(2)).latest().unwrap_err();

    assert_eq!(error.code(), "UPDATE_FEED");
}

#[test]
fn maps_a_missing_required_field_to_an_update_feed_error() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/releases/latest");
        then.status(200)
            .header("content-type", "application/json")
            .body(r#"{"html_url":"https://example.test","draft":false,"prerelease":false}"#);
    });

    let error = feed(&server, Duration::from_secs(2)).latest().unwrap_err();

    assert_eq!(error.code(), "UPDATE_FEED");
    assert!(error.to_string().contains("tag_name"));
}

#[test]
fn maps_a_timeout_to_a_network_error() {
    let server = MockServer::start();
    server.mock(|when, then| {
        when.method(GET).path("/releases/latest");
        then.status(200)
            .header("content-type", "application/json")
            .body_from_file(fixture())
            .delay(Duration::from_millis(600));
    });

    let error = feed(&server, Duration::from_millis(100))
        .latest()
        .unwrap_err();

    assert_eq!(error.code(), "NETWORK");
}
