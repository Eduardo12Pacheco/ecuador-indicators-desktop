"""Integration tests for the DuckDB lakehouse import path."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

import duckdb
import pytest
from typer.testing import CliRunner

from ecuador_data.adapters.lakehouse_duckdb import LakehouseDuckDbSource
from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.application.build import BuildUseCase
from ecuador_data.application.import_lakehouse import ImportLakehouseUseCase
from ecuador_data.cli import app
from ecuador_data.domain.catalog import load_catalog
from ecuador_data.domain.errors import ManifestError
from ecuador_data.domain.integrity import sha256_file
from ecuador_data.domain.manifest import REQUIRED_COLUMNS

runner = CliRunner()
MINI_RAW = Path(__file__).resolve().parents[1] / "fixtures" / "mini_raw"

DDL = {
    "topic": (
        "CREATE TABLE lakehouse.topic ("
        "id VARCHAR PRIMARY KEY, name_en VARCHAR, name_es VARCHAR, sort_order BIGINT)"
    ),
    "geography": (
        "CREATE TABLE lakehouse.geography ("
        "iso3 VARCHAR PRIMARY KEY, iso2 VARCHAR, name_en VARCHAR, name_es VARCHAR, "
        "is_aggregate BOOLEAN, sort_order BIGINT)"
    ),
    "indicator": (
        "CREATE TABLE lakehouse.indicator ("
        "code VARCHAR PRIMARY KEY, topic_id VARCHAR, name_en VARCHAR, name_es VARCHAR, "
        "description_en VARCHAR, description_es VARCHAR, unit_en VARCHAR, unit_es VARCHAR, "
        "value_kind VARCHAR, decimals BIGINT, higher_is VARCHAR, source_org_en VARCHAR, "
        "source_org_es VARCHAR, sort_order BIGINT)"
    ),
    "observation": (
        "CREATE TABLE lakehouse.observation ("
        "indicator_code VARCHAR, iso3 VARCHAR, year BIGINT, value DOUBLE)"
    ),
}


def _dataset(tmp_path: Path) -> Any:
    data_dir = tmp_path / "data"
    shutil.copytree(MINI_RAW, data_dir)
    snapshot = tmp_path / "source.sqlite"
    BuildUseCase(
        store=FileRawStore(data_dir),
        writer=SqliteSnapshotWriter(),
        catalog=load_catalog(),
    ).execute(snapshot)
    return SqliteSnapshotWriter().read(snapshot).dataset


def _write_duckdb(path: Path, dataset: Any) -> None:
    connection = duckdb.connect(str(path))
    try:
        connection.execute("CREATE SCHEMA lakehouse")
        for ddl in DDL.values():
            connection.execute(ddl)
        connection.executemany(
            "INSERT INTO lakehouse.topic VALUES (?, ?, ?, ?)",
            [(t.id, t.name_en, t.name_es, t.sort_order) for t in dataset.topics],
        )
        connection.executemany(
            "INSERT INTO lakehouse.geography VALUES (?, ?, ?, ?, ?, ?)",
            [
                (g.iso3, g.iso2, g.name_en, g.name_es, g.is_aggregate, g.sort_order)
                for g in dataset.geographies
            ],
        )
        connection.executemany(
            "INSERT INTO lakehouse.indicator VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                (
                    i.code,
                    i.topic_id,
                    i.name_en,
                    i.name_es,
                    i.description_en,
                    i.description_es,
                    i.unit_en,
                    i.unit_es,
                    i.value_kind,
                    i.decimals,
                    i.higher_is,
                    i.source_org_en,
                    i.source_org_es,
                    i.sort_order,
                )
                for i in dataset.indicators
            ],
        )
        connection.executemany(
            "INSERT INTO lakehouse.observation VALUES (?, ?, ?, ?)",
            [(o.indicator_code, o.iso3, o.year, o.value) for o in dataset.observations],
        )
    finally:
        connection.close()


def _manifest(duckdb_path: Path, *, version: str = "1.0") -> dict[str, Any]:
    return {
        "manifest_version": version,
        "kind": "ecuador-indicators-lakehouse-export",
        "generated_at": "2026-11-20T07:00:00+00:00",
        "dataset": {
            "id": "sibling-lakehouse",
            "version": "2026.11",
            "title": "Sibling lakehouse export",
        },
        "license": {
            "spdx": "CC-BY-4.0",
            "url": "https://creativecommons.org/licenses/by/4.0/",
            "attribution_en": "Source: sibling lakehouse export (CC BY 4.0).",
            "attribution_es": "Fuente: exportación del lakehouse hermano (CC BY 4.0).",
        },
        "duckdb": {
            "path": duckdb_path.name,
            "sha256": sha256_file(duckdb_path),
        },
        "relations": {
            table: {
                "relation": f"lakehouse.{relation}",
                "columns": {column: column for column in columns},
            }
            for table, relation, columns in (
                ("topics", "topic", REQUIRED_COLUMNS["topics"]),
                ("geographies", "geography", REQUIRED_COLUMNS["geographies"]),
                ("indicators", "indicator", REQUIRED_COLUMNS["indicators"]),
                ("observations", "observation", REQUIRED_COLUMNS["observations"]),
            )
        },
    }


def _write_manifest(path: Path, payload: dict[str, Any]) -> Path:
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


@pytest.fixture
def lakehouse(tmp_path: Path) -> tuple[Path, Path]:
    dataset = _dataset(tmp_path)
    duckdb_path = tmp_path / "export.duckdb"
    _write_duckdb(duckdb_path, dataset)
    manifest_path = _write_manifest(tmp_path / "manifest.json", _manifest(duckdb_path))
    return duckdb_path, manifest_path


def test_import_writes_a_valid_snapshot(lakehouse: tuple[Path, Path], tmp_path: Path) -> None:
    _duckdb_path, manifest_path = lakehouse
    out = tmp_path / "imported.sqlite"
    result = ImportLakehouseUseCase(
        source=LakehouseDuckDbSource(), writer=SqliteSnapshotWriter()
    ).execute(manifest_path, out)

    read = SqliteSnapshotWriter().read(out)
    assert read.meta["origin"] == "lakehouse"
    assert read.meta["license"] == "CC-BY-4.0"
    assert read.meta["license_url"] == "https://creativecommons.org/licenses/by/4.0/"
    assert read.meta["attribution_en"] == "Source: sibling lakehouse export (CC BY 4.0)."
    assert read.meta["attribution_es"] == "Fuente: exportación del lakehouse hermano (CC BY 4.0)."
    assert read.meta["dataset_id"] == "sibling-lakehouse"
    assert read.dataset.counts().indicators == 2
    assert read.dataset.counts().geographies == 3
    assert result.indicators == read.dataset.counts().indicators
    assert result.logical_sha256 == read.meta["logical_sha256"]


def test_import_cli_reports_the_counts(lakehouse: tuple[Path, Path], tmp_path: Path) -> None:
    _duckdb_path, manifest_path = lakehouse
    out = tmp_path / "cli.sqlite"
    result = runner.invoke(
        app, ["import-lakehouse", "--manifest", str(manifest_path), "--out", str(out)]
    )
    assert result.exit_code == 0, result.stderr
    assert out.is_file()
    assert "imported" in result.stdout
    assert "counts:" in result.stdout


def test_import_rejects_a_checksum_mismatch(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path)
    duckdb_path = tmp_path / "export.duckdb"
    _write_duckdb(duckdb_path, dataset)
    payload = _manifest(duckdb_path)
    payload["duckdb"]["sha256"] = "b" * 64
    manifest_path = _write_manifest(tmp_path / "manifest.json", payload)
    out = tmp_path / "out.sqlite"

    with pytest.raises(ManifestError, match="checksum mismatch"):
        ImportLakehouseUseCase(
            source=LakehouseDuckDbSource(), writer=SqliteSnapshotWriter()
        ).execute(manifest_path, out)
    result = runner.invoke(
        app, ["import-lakehouse", "--manifest", str(manifest_path), "--out", str(out)]
    )
    assert result.exit_code == 2
    assert "checksum mismatch" in result.stderr
    assert not out.exists()


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda payload: payload.update({"manifest_version": "2.0"}), "manifest_version"),
        (
            lambda payload: payload["relations"]["observations"]["columns"].pop("year"),
            "missing column mapping",
        ),
        (
            lambda payload: payload["relations"]["observations"]["columns"].update(
                {"year": "year; DROP TABLE lakehouse.observation"}
            ),
            "column",
        ),
        (
            lambda payload: payload["relations"]["observations"].update(
                {"relation": "lakehouse.observation; SELECT 1"}
            ),
            "relation",
        ),
    ],
)
def test_import_cli_exits_2_on_an_invalid_manifest(
    lakehouse: tuple[Path, Path],
    tmp_path: Path,
    mutate: Any,
    message: str,
) -> None:
    duckdb_path, _manifest_path = lakehouse
    payload = _manifest(duckdb_path)
    mutate(payload)
    manifest_path = _write_manifest(tmp_path / "broken.json", payload)
    out = tmp_path / "out.sqlite"
    result = runner.invoke(
        app, ["import-lakehouse", "--manifest", str(manifest_path), "--out", str(out)]
    )
    assert result.exit_code == 2, result.stdout
    assert message in result.stderr
    assert not out.exists()


def test_import_rejects_a_missing_duckdb_file(tmp_path: Path) -> None:
    dataset = _dataset(tmp_path)
    duckdb_path = tmp_path / "export.duckdb"
    _write_duckdb(duckdb_path, dataset)
    payload = _manifest(duckdb_path)
    manifest_path = _write_manifest(tmp_path / "manifest.json", payload)
    duckdb_path.unlink()
    with pytest.raises(ManifestError, match="not found"):
        ImportLakehouseUseCase(
            source=LakehouseDuckDbSource(), writer=SqliteSnapshotWriter()
        ).execute(manifest_path, tmp_path / "out.sqlite")


def test_import_rejects_a_missing_relation(lakehouse: tuple[Path, Path], tmp_path: Path) -> None:
    _duckdb_path, manifest_path = lakehouse
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["relations"]["topics"]["relation"] = "lakehouse.missing_topic"
    manifest_path = _write_manifest(tmp_path / "broken.json", payload)
    with pytest.raises(ManifestError, match="missing_topic"):
        ImportLakehouseUseCase(
            source=LakehouseDuckDbSource(), writer=SqliteSnapshotWriter()
        ).execute(manifest_path, tmp_path / "out.sqlite")


def test_import_rejects_a_missing_physical_column(
    lakehouse: tuple[Path, Path], tmp_path: Path
) -> None:
    _duckdb_path, manifest_path = lakehouse
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["relations"]["observations"]["columns"]["value"] = "amount"
    manifest_path = _write_manifest(tmp_path / "broken.json", payload)
    with pytest.raises(ManifestError, match="amount"):
        ImportLakehouseUseCase(
            source=LakehouseDuckDbSource(), writer=SqliteSnapshotWriter()
        ).execute(manifest_path, tmp_path / "out.sqlite")


def test_import_rejects_dangling_observations(lakehouse: tuple[Path, Path], tmp_path: Path) -> None:
    duckdb_path, manifest_path = lakehouse
    connection = duckdb.connect(str(duckdb_path))
    try:
        connection.execute("INSERT INTO lakehouse.observation VALUES ('UNKNOWN', 'ECU', 1900, 1.0)")
    finally:
        connection.close()
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    payload["duckdb"]["sha256"] = sha256_file(duckdb_path)
    manifest_path = _write_manifest(tmp_path / "broken.json", payload)
    with pytest.raises(ManifestError, match="unknown indicator"):
        ImportLakehouseUseCase(
            source=LakehouseDuckDbSource(), writer=SqliteSnapshotWriter()
        ).execute(manifest_path, tmp_path / "out.sqlite")
