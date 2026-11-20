"""Unit tests for typed settings."""

from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from ecuador_data.settings import Settings, default_data_dir, load_settings


def test_defaults() -> None:
    settings = Settings(_env_file=None)
    assert settings.data_dir == default_data_dir()
    assert settings.data_dir.name == "data"
    assert settings.http_timeout_s == 30.0
    assert settings.http_retries == 4
    assert "ecuador-data/" in settings.user_agent
    assert settings.log_level == "INFO"


def test_default_data_dir_points_to_the_repository_data_directory() -> None:
    assert default_data_dir() == Path(__file__).resolve().parents[2].parent / "data"


def test_environment_overrides(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ECUADOR_DATA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ECUADOR_DATA_HTTP_TIMEOUT_S", "5")
    monkeypatch.setenv("ECUADOR_DATA_HTTP_RETRIES", "2")
    monkeypatch.setenv("ECUADOR_DATA_USER_AGENT", "custom-agent")
    monkeypatch.setenv("ECUADOR_DATA_LOG_LEVEL", "DEBUG")
    settings = load_settings()
    assert settings.data_dir == tmp_path
    assert settings.http_timeout_s == 5.0
    assert settings.http_retries == 2
    assert settings.user_agent == "custom-agent"
    assert settings.log_level == "DEBUG"


def test_invalid_timeout_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ECUADOR_DATA_HTTP_TIMEOUT_S", "0")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_retries_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ECUADOR_DATA_HTTP_RETRIES", "0")
    with pytest.raises(ValidationError):
        Settings(_env_file=None)
