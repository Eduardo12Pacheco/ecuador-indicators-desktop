"""Shared fixtures for the pipeline test suite."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pytest

TESTS_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = TESTS_DIR / "fixtures"
WORLDBANK_FIXTURES = FIXTURES_DIR / "worldbank"
MINI_RAW = FIXTURES_DIR / "mini_raw"


@dataclass(frozen=True)
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


@pytest.fixture
def fixed_clock() -> FixedClock:
    return FixedClock(datetime(2026, 11, 20, 12, 0, 0, tzinfo=UTC))


@pytest.fixture
def mini_copy(tmp_path: Path) -> Path:
    target = tmp_path / "data"
    shutil.copytree(MINI_RAW, target)
    return target


def read_fixture(name: str) -> object:
    return json.loads((WORLDBANK_FIXTURES / name).read_text(encoding="utf-8"))
