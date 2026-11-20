"""Integration tests for the SQLite snapshot adapter."""

from __future__ import annotations

import shutil
import sqlite3
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.domain.errors import IntegrityError
from ecuador_data.domain.models import Observation

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "mini_raw"


def _fixture_snapshot(tmp_path: Path) -> Path:
    target = tmp_path / "snapshot.sqlite"
    shutil.copyfile(FIXTURE / "snapshot" / "ecuador-indicators.snapshot.sqlite", target)
    return target


def test_round_trip_preserves_observations(tmp_path: Path) -> None:
    writer = SqliteSnapshotWriter()
    read = writer.read(FIXTURE / "snapshot" / "ecuador-indicators.snapshot.sqlite")
    target = tmp_path / "out.sqlite"
    logical = writer.write(read.dataset, read.meta, target)
    again = writer.read(target)
    assert again.dataset.observations == read.dataset.observations
    assert again.dataset.indicators == read.dataset.indicators
    assert again.meta["logical_sha256"] == logical
    observation = Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=2000, value=1.5)
    assert observation.value == 1.5


def test_schema_uses_user_version_one(tmp_path: Path) -> None:
    target = _fixture_snapshot(tmp_path)
    with sqlite3.connect(target) as connection:
        version = connection.execute("PRAGMA user_version").fetchone()[0]
        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
    assert version == 1
    assert {"meta", "topic", "geography", "indicator", "observation"} <= tables


def test_schema_rejects_invalid_indicator_kind_and_year(tmp_path: Path) -> None:
    target = _fixture_snapshot(tmp_path)
    with sqlite3.connect(target) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "UPDATE indicator SET value_kind = 'money' WHERE code = 'NY.GDP.MKTP.CD'"
            )
        with pytest.raises(sqlite3.IntegrityError):
            connection.execute(
                "INSERT INTO observation (indicator_code, iso3, year, value) "
                "VALUES ('NY.GDP.MKTP.CD', 'ECU', 1800, 1.0)"
            )


def test_read_rejects_a_missing_file(tmp_path: Path) -> None:
    with pytest.raises(IntegrityError, match="snapshot not found"):
        SqliteSnapshotWriter().read(tmp_path / "missing.sqlite")


def test_read_rejects_a_wrong_user_version(tmp_path: Path) -> None:
    target = _fixture_snapshot(tmp_path)
    with sqlite3.connect(target) as connection:
        connection.execute("PRAGMA user_version = 2")
    with pytest.raises(IntegrityError, match="schema version mismatch"):
        SqliteSnapshotWriter().read(target)


def test_read_rejects_a_missing_table(tmp_path: Path) -> None:
    target = _fixture_snapshot(tmp_path)
    with sqlite3.connect(target) as connection:
        connection.execute("DROP TABLE observation")
    with pytest.raises(IntegrityError, match="missing required tables"):
        SqliteSnapshotWriter().read(target)


def test_read_rejects_a_corrupt_file(tmp_path: Path) -> None:
    target = tmp_path / "corrupt.sqlite"
    target.write_bytes(b"this is not a database")
    with pytest.raises(IntegrityError, match="not a valid schema v1 database"):
        SqliteSnapshotWriter().read(target)


def test_read_rejects_a_meta_schema_version_mismatch(tmp_path: Path) -> None:
    target = _fixture_snapshot(tmp_path)
    with sqlite3.connect(target) as connection:
        connection.execute("UPDATE meta SET value = '2' WHERE key = 'schema_version'")
    with pytest.raises(IntegrityError, match="meta.schema_version mismatch"):
        SqliteSnapshotWriter().read(target)


def test_read_rejects_invalid_rows(tmp_path: Path) -> None:
    target = _fixture_snapshot(tmp_path)
    with sqlite3.connect(target) as connection:
        connection.execute("UPDATE indicator SET name_en = '' WHERE code = 'NY.GDP.MKTP.CD'")
    with pytest.raises(IntegrityError, match="invalid rows"):
        SqliteSnapshotWriter().read(target)


def test_read_rejects_incomplete_meta(tmp_path: Path) -> None:
    target = _fixture_snapshot(tmp_path)
    with sqlite3.connect(target) as connection:
        connection.execute("DELETE FROM meta WHERE key = 'license_url'")
    with pytest.raises(IntegrityError, match="meta is incomplete"):
        SqliteSnapshotWriter().read(target)


@given(
    points=st.lists(
        st.tuples(
            st.integers(min_value=1900, max_value=2100),
            st.floats(allow_nan=False, allow_infinity=False),
        ),
        unique_by=lambda item: item[0],
        min_size=1,
        max_size=20,
    )
)
@settings(
    max_examples=10,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
def test_observation_round_trip_property(tmp_path: Path, points: list[tuple[int, float]]) -> None:
    writer = SqliteSnapshotWriter()
    read = writer.read(FIXTURE / "snapshot" / "ecuador-indicators.snapshot.sqlite")
    observations = tuple(
        Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=year, value=value)
        for year, value in points
    )
    dataset = read.dataset.model_copy(update={"observations": observations})
    target = tmp_path / "property.sqlite"
    writer.write(dataset, read.meta, target)
    again = writer.read(target)
    assert again.dataset.observations == tuple(
        sorted(observations, key=lambda item: (item.indicator_code, item.iso3, item.year))
    )


def test_write_is_atomic_and_leaves_no_temp_file(tmp_path: Path) -> None:
    writer = SqliteSnapshotWriter()
    read = writer.read(FIXTURE / "snapshot" / "ecuador-indicators.snapshot.sqlite")
    target = tmp_path / "atomic.sqlite"
    writer.write(read.dataset, read.meta, target)
    assert target.is_file()
    assert list(tmp_path.glob(".*.tmp")) == []
