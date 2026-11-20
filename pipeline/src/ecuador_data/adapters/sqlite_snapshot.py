"""SQLite snapshot adapter (schema v1)."""

from __future__ import annotations

import os
import sqlite3
import tempfile
from collections.abc import Mapping
from pathlib import Path
from urllib.parse import quote

from pydantic import ValidationError

from ecuador_data.domain.errors import IntegrityError
from ecuador_data.domain.integrity import dataset_logical_sha256
from ecuador_data.domain.models import (
    Dataset,
    Geography,
    Indicator,
    Observation,
    SnapshotRead,
    SourceInfo,
    Topic,
)

SCHEMA_VERSION = 1
REQUIRED_TABLES = frozenset({"meta", "topic", "geography", "indicator", "observation"})

SCHEMA_DDL = """
PRAGMA user_version = 1;

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;

CREATE TABLE topic (
  id TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  sort_order INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE geography (
  iso3 TEXT PRIMARY KEY,
  iso2 TEXT NOT NULL,
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  is_aggregate INTEGER NOT NULL CHECK (is_aggregate IN (0,1)),
  sort_order INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE indicator (
  code TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topic(id),
  name_en TEXT NOT NULL,
  name_es TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_es TEXT NOT NULL,
  unit_en TEXT NOT NULL,
  unit_es TEXT NOT NULL,
  value_kind TEXT NOT NULL
    CHECK (value_kind IN ('currency','percent','number','years','rate','index')),
  decimals INTEGER NOT NULL CHECK (decimals BETWEEN 0 AND 4),
  higher_is TEXT NOT NULL CHECK (higher_is IN ('better','worse','neutral')),
  source_org_en TEXT NOT NULL,
  source_org_es TEXT NOT NULL,
  sort_order INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE observation (
  indicator_code TEXT NOT NULL REFERENCES indicator(code),
  iso3 TEXT NOT NULL REFERENCES geography(iso3),
  year INTEGER NOT NULL CHECK (year BETWEEN 1900 AND 2100),
  value REAL NOT NULL,
  PRIMARY KEY (indicator_code, iso3, year)
) WITHOUT ROWID;
"""


def _connect_for_write(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _connect_read_only(path: Path) -> sqlite3.Connection:
    uri = f"file:{quote(str(path.resolve()))}?mode=ro"
    connection = sqlite3.connect(uri, uri=True)
    connection.execute("PRAGMA query_only = ON")
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _table_names(connection: sqlite3.Connection) -> set[str]:
    rows = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return {str(row[0]) for row in rows}


class SqliteSnapshotWriter:
    """Writes schema-v1 snapshots atomically and reads them back."""

    def write(self, dataset: Dataset, meta: Mapping[str, str], path: Path) -> str:
        target = Path(path)
        target.parent.mkdir(parents=True, exist_ok=True)
        logical = dataset_logical_sha256(dataset, meta)
        complete_meta = dict(meta)
        complete_meta["logical_sha256"] = logical

        descriptor, temp_name = tempfile.mkstemp(
            prefix=f".{target.name}.", suffix=".tmp", dir=target.parent
        )
        os.close(descriptor)
        temp_path = Path(temp_name)
        try:
            connection = _connect_for_write(temp_path)
            try:
                with connection:
                    connection.executescript(SCHEMA_DDL)
                    connection.executemany(
                        "INSERT INTO topic (id, name_en, name_es, sort_order) VALUES (?, ?, ?, ?)",
                        [
                            (topic.id, topic.name_en, topic.name_es, topic.sort_order)
                            for topic in sorted(dataset.topics, key=lambda item: item.id)
                        ],
                    )
                    connection.executemany(
                        "INSERT INTO geography "
                        "(iso3, iso2, name_en, name_es, is_aggregate, sort_order) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        [
                            (
                                geography.iso3,
                                geography.iso2,
                                geography.name_en,
                                geography.name_es,
                                int(geography.is_aggregate),
                                geography.sort_order,
                            )
                            for geography in sorted(dataset.geographies, key=lambda item: item.iso3)
                        ],
                    )
                    connection.executemany(
                        "INSERT INTO indicator (code, topic_id, name_en, name_es, "
                        "description_en, description_es, unit_en, unit_es, value_kind, "
                        "decimals, higher_is, source_org_en, source_org_es, sort_order) "
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [
                            (
                                indicator.code,
                                indicator.topic_id,
                                indicator.name_en,
                                indicator.name_es,
                                indicator.description_en,
                                indicator.description_es,
                                indicator.unit_en,
                                indicator.unit_es,
                                indicator.value_kind,
                                indicator.decimals,
                                indicator.higher_is,
                                indicator.source_org_en,
                                indicator.source_org_es,
                                indicator.sort_order,
                            )
                            for indicator in sorted(dataset.indicators, key=lambda item: item.code)
                        ],
                    )
                    connection.executemany(
                        "INSERT INTO observation (indicator_code, iso3, year, value) "
                        "VALUES (?, ?, ?, ?)",
                        [
                            (
                                observation.indicator_code,
                                observation.iso3,
                                observation.year,
                                float(observation.value),
                            )
                            for observation in sorted(
                                dataset.observations,
                                key=lambda item: (
                                    item.indicator_code,
                                    item.iso3,
                                    item.year,
                                ),
                            )
                        ],
                    )
                    connection.executemany(
                        "INSERT INTO meta (key, value) VALUES (?, ?)",
                        sorted(complete_meta.items()),
                    )
            finally:
                connection.close()
            temp_path.replace(target)
        except BaseException:
            temp_path.unlink(missing_ok=True)
            raise
        return logical

    def read(self, path: Path) -> SnapshotRead:
        target = Path(path)
        if not target.is_file():
            raise IntegrityError(f"snapshot not found: {target}")
        try:
            connection = _connect_read_only(target)
        except sqlite3.Error as exc:
            raise IntegrityError(f"snapshot cannot be opened: {target}: {exc}") from exc
        try:
            return self._read(connection, target)
        except sqlite3.Error as exc:
            raise IntegrityError(f"snapshot is not a valid schema v1 database: {exc}") from exc
        except ValidationError as exc:
            raise IntegrityError(f"snapshot contains invalid rows: {exc}") from exc
        finally:
            connection.close()

    def _read(self, connection: sqlite3.Connection, path: Path) -> SnapshotRead:
        quick_check = connection.execute("PRAGMA quick_check").fetchone()
        if quick_check is None or str(quick_check[0]) != "ok":
            raise IntegrityError(f"snapshot failed PRAGMA quick_check: {path}")
        user_version = int(connection.execute("PRAGMA user_version").fetchone()[0])
        if user_version != SCHEMA_VERSION:
            raise IntegrityError(
                f"snapshot schema version mismatch: expected {SCHEMA_VERSION}, got {user_version}"
            )
        missing = REQUIRED_TABLES - _table_names(connection)
        if missing:
            raise IntegrityError(
                "snapshot is missing required tables: " + ", ".join(sorted(missing))
            )
        meta_rows = connection.execute("SELECT key, value FROM meta").fetchall()
        meta = {str(key): str(value) for key, value in meta_rows}
        if meta.get("schema_version") != str(SCHEMA_VERSION):
            raise IntegrityError(
                "snapshot meta.schema_version mismatch: "
                f"expected {SCHEMA_VERSION}, got {meta.get('schema_version')!r}"
            )

        topics = tuple(
            Topic(id=str(row[0]), name_en=str(row[1]), name_es=str(row[2]), sort_order=int(row[3]))
            for row in connection.execute(
                "SELECT id, name_en, name_es, sort_order FROM topic ORDER BY id"
            )
        )
        geographies = tuple(
            Geography(
                iso3=str(row[0]),
                iso2=str(row[1]),
                name_en=str(row[2]),
                name_es=str(row[3]),
                is_aggregate=bool(row[4]),
                sort_order=int(row[5]),
            )
            for row in connection.execute(
                "SELECT iso3, iso2, name_en, name_es, is_aggregate, sort_order "
                "FROM geography ORDER BY iso3"
            )
        )
        indicators = tuple(
            Indicator(
                code=str(row[0]),
                topic_id=str(row[1]),
                name_en=str(row[2]),
                name_es=str(row[3]),
                description_en=str(row[4]),
                description_es=str(row[5]),
                unit_en=str(row[6]),
                unit_es=str(row[7]),
                value_kind=row[8],
                decimals=int(row[9]),
                higher_is=row[10],
                source_org_en=str(row[11]),
                source_org_es=str(row[12]),
                sort_order=int(row[13]),
            )
            for row in connection.execute(
                "SELECT code, topic_id, name_en, name_es, description_en, description_es, "
                "unit_en, unit_es, value_kind, decimals, higher_is, source_org_en, "
                "source_org_es, sort_order FROM indicator ORDER BY code"
            )
        )
        observations = tuple(
            Observation(
                indicator_code=str(row[0]), iso3=str(row[1]), year=int(row[2]), value=float(row[3])
            )
            for row in connection.execute(
                "SELECT indicator_code, iso3, year, value FROM observation "
                "ORDER BY indicator_code, iso3, year"
            )
        )
        try:
            source = SourceInfo(
                dataset_id=meta["dataset_id"],
                dataset_version=meta["dataset_version"],
                name=meta["source_name"],
                publisher=meta["source_publisher"],
                api="https://api.worldbank.org/v2",
                source_id=meta.get("source_id", "2"),
                source_last_updated=meta["source_last_updated"],
                license=meta["license"],
                license_url=meta["license_url"],
                terms_url="https://datacatalog.worldbank.org/public-licenses",
                retrieved_at=meta["retrieved_at"],
            )
        except (KeyError, ValidationError) as exc:
            raise IntegrityError(f"snapshot meta is incomplete: {exc}") from exc

        dataset = Dataset(
            topics=topics,
            geographies=geographies,
            indicators=indicators,
            observations=observations,
            source=source,
        )
        return SnapshotRead(dataset=dataset, meta=meta)
