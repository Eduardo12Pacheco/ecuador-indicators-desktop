"""Integration tests for the deterministic JSON export."""

from __future__ import annotations

import json
from pathlib import Path

from typer.testing import CliRunner

from ecuador_data.adapters.json_export import JsonSnapshotExporter
from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.application.export_json import ExportJsonUseCase
from ecuador_data.cli import app
from ecuador_data.domain.catalog import load_catalog, load_mini_catalog

runner = CliRunner()


def _usecase(data_dir: Path, catalog) -> ExportJsonUseCase:
    return ExportJsonUseCase(
        store=FileRawStore(data_dir),
        writer=SqliteSnapshotWriter(),
        exporter=JsonSnapshotExporter(),
        catalog=catalog,
    )


def test_mini_export_is_deterministic_and_filtered(mini_copy: Path, tmp_path: Path) -> None:
    usecase = _usecase(mini_copy, load_mini_catalog())
    first = usecase.execute(tmp_path / "first.json")
    second = usecase.execute(tmp_path / "second.json")

    assert (tmp_path / "first.json").read_bytes() == (tmp_path / "second.json").read_bytes()
    assert first.bytes == second.bytes
    payload = json.loads((tmp_path / "first.json").read_text(encoding="utf-8"))
    assert set(payload) == {
        "schema_version",
        "meta",
        "topics",
        "geographies",
        "indicators",
        "observations",
    }
    assert payload["schema_version"] == 1
    # The mini raw fixture only carries two of the six curated mini indicators
    # and three of its five geographies, so the export is the intersection.
    assert {row["code"] for row in payload["indicators"]} == {
        "NY.GDP.MKTP.CD",
        "SI.POV.NAHC",
    }
    assert {row["iso3"] for row in payload["geographies"]} == {"ECU", "COL", "LCN"}
    assert {row["id"] for row in payload["topics"]} == {"economy", "labour", "society"}
    assert payload["observations"]
    for row in payload["observations"]:
        assert len(row) == 4
        assert isinstance(row[0], str)
        assert isinstance(row[1], str)
        assert isinstance(row[2], int)
        assert isinstance(row[3], float)
    assert "attribution_en" in payload["meta"]
    assert "attribution_es" in payload["meta"]
    assert "logical_sha256" not in payload["meta"]
    assert first.observations == len(payload["observations"])


def test_full_export_uses_the_full_catalog(mini_copy: Path, tmp_path: Path) -> None:
    result = _usecase(mini_copy, load_catalog()).execute(tmp_path / "full.json")
    payload = json.loads((tmp_path / "full.json").read_text(encoding="utf-8"))
    assert len(payload["indicators"]) == 2
    assert len(payload["geographies"]) == 3
    assert len(payload["topics"]) == 8
    assert result.indicators == 2


def test_export_observations_are_sorted(mini_copy: Path, tmp_path: Path) -> None:
    _usecase(mini_copy, load_mini_catalog()).execute(tmp_path / "mini.json")
    payload = json.loads((tmp_path / "mini.json").read_text(encoding="utf-8"))
    keys = [(row[0], row[1], row[2]) for row in payload["observations"]]
    assert keys == sorted(keys)
    assert len(keys) == len(set(keys))


def test_export_json_cli_writes_the_file(mini_copy: Path, tmp_path: Path) -> None:
    out = tmp_path / "cli.json"
    result = runner.invoke(
        app,
        ["export-json", "--subset", "mini", "--data-dir", str(mini_copy), "--out", str(out)],
    )
    assert result.exit_code == 0, result.stderr
    assert out.is_file()
    payload = json.loads(out.read_text(encoding="utf-8"))
    assert len(payload["indicators"]) == 2
    assert "exported" in result.stdout


def test_export_json_cli_rejects_an_unknown_subset(mini_copy: Path, tmp_path: Path) -> None:
    result = runner.invoke(
        app,
        ["export-json", "--subset", "tiny", "--data-dir", str(mini_copy), "--out", str(tmp_path)],
    )
    assert result.exit_code == 2


def test_export_json_cli_requires_the_raw_cache(tmp_path: Path) -> None:
    result = runner.invoke(
        app, ["export-json", "--subset", "mini", "--data-dir", str(tmp_path), "--out", "x.json"]
    )
    assert result.exit_code == 2
    assert "manifest" in result.stderr.lower()
