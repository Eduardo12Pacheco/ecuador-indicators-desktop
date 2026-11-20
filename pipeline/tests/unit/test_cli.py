"""Unit tests for the CLI exit codes and output."""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

import ecuador_data.cli as cli_module
from ecuador_data import __version__
from ecuador_data.application.refresh import RefreshResult
from ecuador_data.cli import app
from ecuador_data.domain.errors import SourceUnavailableError

runner = CliRunner()


def test_version_flag_prints_version() -> None:
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert f"ecuador-data {__version__}" in result.stdout


def test_help_lists_the_cli() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "ecuador-data" in result.stdout
    for command in ("refresh", "build", "verify"):
        assert command in result.stdout


def test_build_command_prints_the_logical_hash(mini_copy: Path, tmp_path: Path) -> None:
    out = tmp_path / "snapshot.sqlite"
    first = runner.invoke(app, ["build", "--data-dir", str(mini_copy), "--out", str(out)])
    assert first.exit_code == 0, first.stderr
    assert "logical_sha256:" in first.stdout
    assert "counts: topics=8 geographies=3 indicators=2 observations=236" in first.stdout

    second = runner.invoke(app, ["build", "--data-dir", str(mini_copy), "--out", str(out)])
    assert second.exit_code == 0
    first_hash = next(
        line for line in first.stdout.splitlines() if line.startswith("logical_sha256")
    )
    second_hash = next(
        line for line in second.stdout.splitlines() if line.startswith("logical_sha256")
    )
    assert first_hash == second_hash


def test_verify_command_prints_the_counts(mini_copy: Path) -> None:
    result = runner.invoke(app, ["verify", "--data-dir", str(mini_copy)])
    assert result.exit_code == 0, result.stderr
    assert "verify: ok" in result.stdout
    assert "counts: topics=8 geographies=3 indicators=2 observations=236" in result.stdout
    assert "snapshot_sha256:" in result.stdout


def test_verify_command_exits_2_on_a_checksum_mismatch(mini_copy: Path) -> None:
    target = mini_copy / "raw" / "worldbank" / "countries.en.json"
    target.write_bytes(target.read_bytes() + b"x")
    result = runner.invoke(app, ["verify", "--data-dir", str(mini_copy)])
    assert result.exit_code == 2
    assert "checksum mismatch" in result.stderr


def test_build_command_exits_2_without_a_manifest(tmp_path: Path) -> None:
    result = runner.invoke(app, ["build", "--data-dir", str(tmp_path)])
    assert result.exit_code == 2
    assert "build:" in result.stderr


def test_unexpected_error_exits_1(monkeypatch: pytest.MonkeyPatch, mini_copy: Path) -> None:
    def explode() -> None:
        raise RuntimeError("boom")

    monkeypatch.setattr(cli_module, "load_catalog", explode)
    result = runner.invoke(app, ["build", "--data-dir", str(mini_copy)])
    assert result.exit_code == 1
    assert "unexpected error: boom" in result.stderr


def test_source_failure_exits_3(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    class FailingSource:
        def __init__(self, **kwargs: object) -> None:
            self.closed = False

        def fetch_indicators(self, *args: object, **kwargs: object) -> list[object]:
            raise SourceUnavailableError("offline")

        def close(self) -> None:
            self.closed = True

    monkeypatch.setattr(cli_module, "WorldBankApiSource", FailingSource)
    result = runner.invoke(app, ["refresh", "--data-dir", str(tmp_path)])
    assert result.exit_code == 3
    assert "offline" in result.stderr


def test_refresh_command_reports_the_manifest(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    class QuietSource:
        def __init__(self, **kwargs: object) -> None:
            pass

        def close(self) -> None:
            pass

    class FakeRefresh:
        def __init__(self, **kwargs: object) -> None:
            pass

        def execute(self) -> RefreshResult:
            return RefreshResult(
                raw_files=42,
                retrieved_at="2026-11-20T00:00:00+00:00",
                source_last_updated="2026-11-11",
                manifest_path="/data/MANIFEST.json",
            )

    monkeypatch.setattr(cli_module, "WorldBankApiSource", QuietSource)
    monkeypatch.setattr(cli_module, "RefreshUseCase", FakeRefresh)
    result = runner.invoke(app, ["refresh", "--data-dir", str(tmp_path)])
    assert result.exit_code == 0, result.stderr
    assert "refreshed 42 raw files" in result.stdout
    assert "source_last_updated: 2026-11-11" in result.stdout
