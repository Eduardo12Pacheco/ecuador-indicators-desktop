"""Unit tests for the deterministic build use case."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.application.build import BuildResult, BuildUseCase
from ecuador_data.domain.catalog import Catalog, load_catalog
from ecuador_data.domain.errors import IntegrityError, ManifestError
from ecuador_data.domain.models import RawFileRecord


def _usecase(store: FileRawStore) -> BuildUseCase:
    return BuildUseCase(store=store, writer=SqliteSnapshotWriter(), catalog=load_catalog())


def _rewrite(store: FileRawStore, relative_path: str, payload: object) -> None:
    manifest = store.read_manifest()
    previous = next(record for record in manifest.raw_files if record.path == relative_path)
    record = store.write_json(relative_path, payload, url=previous.url)
    records = tuple(record if item.path == relative_path else item for item in manifest.raw_files)
    store.write_manifest(manifest.model_copy(update={"raw_files": records}))


def _read(store: FileRawStore, relative_path: str) -> dict[str, Any]:
    payload = store.read_json(relative_path)
    assert isinstance(payload, dict)
    return payload


def test_build_produces_the_mini_snapshot(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    result = _usecase(store).execute(tmp_path / "out.sqlite")
    assert isinstance(result, BuildResult)
    assert (result.topics, result.geographies, result.indicators, result.observations) == (
        8,
        3,
        2,
        236,
    )
    read = SqliteSnapshotWriter().read(Path(result.path))
    english = {indicator.code: indicator for indicator in read.dataset.indicators}
    assert english["NY.GDP.MKTP.CD"].name_en == "GDP (current US$)"
    assert english["NY.GDP.MKTP.CD"].name_es == "PIB (US$ a precios actuales)"
    assert english["NY.GDP.MKTP.CD"].unit_en == "current US$"
    geographies = {geography.iso3: geography for geography in read.dataset.geographies}
    assert geographies["ECU"].name_en == "Ecuador"
    assert geographies["COL"].iso2 == "CO"
    assert "LCN" in geographies
    assert read.meta["license"] == "CC-BY-4.0"
    assert read.meta["origin"] == "worldbank"


def test_build_is_deterministic(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    first = _usecase(store).execute(tmp_path / "first.sqlite")
    second = _usecase(store).execute(tmp_path / "second.sqlite")
    assert first.logical_sha256 == second.logical_sha256
    assert Path(first.path).read_bytes() == Path(second.path).read_bytes()


def test_build_updates_the_manifest_only_for_the_canonical_snapshot(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    result = _usecase(store).execute()
    manifest = store.read_manifest()
    assert manifest.snapshot is not None
    assert manifest.snapshot.logical_sha256 == result.logical_sha256
    assert manifest.snapshot.counts.indicators == 2

    other = _usecase(store).execute(mini_copy / "elsewhere.sqlite")
    assert store.read_manifest().snapshot.logical_sha256 == result.logical_sha256
    assert Path(other.path).is_file()


def test_build_uses_the_curated_spanish_fallback(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    relative = "raw/worldbank/indicators.es.json"
    payload = store.read_json(relative)
    assert isinstance(payload, list)
    for entry in payload:
        if entry.get("id") == "NY.GDP.MKTP.CD":
            entry["name"] = ""
            entry["sourceNote"] = ""
            entry["sourceOrganization"] = ""
    _rewrite(store, relative, payload)

    base = load_catalog()
    indicator = next(item for item in base.indicators if item.code == "NY.GDP.MKTP.CD").model_copy(
        update={
            "fallback_name_es": "PIB de respaldo",
            "fallback_description_es": "Descripción de respaldo",
            "fallback_source_org_es": "Fuente de respaldo",
        }
    )
    catalog = Catalog(topics=base.topics, geographies=base.geographies, indicators=(indicator,))
    result = BuildUseCase(store=store, writer=SqliteSnapshotWriter(), catalog=catalog).execute(
        tmp_path / "fallback.sqlite"
    )
    read = SqliteSnapshotWriter().read(Path(result.path))
    built = read.dataset.indicators[0]
    assert built.name_es == "PIB de respaldo"
    assert built.description_es == "Descripción de respaldo"
    assert built.source_org_es == "Fuente de respaldo"


def test_build_rejects_an_empty_spanish_name_without_a_fallback(
    mini_copy: Path, tmp_path: Path
) -> None:
    store = FileRawStore(mini_copy)
    relative = "raw/worldbank/indicators.es.json"
    payload = store.read_json(relative)
    assert isinstance(payload, list)
    for entry in payload:
        if entry.get("id") == "NY.GDP.MKTP.CD":
            entry["name"] = ""
    _rewrite(store, relative, payload)
    with pytest.raises(IntegrityError, match="has no name"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_requires_a_manifest(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    store.manifest_path.unlink()
    with pytest.raises(ManifestError, match="manifest not found"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_rejects_a_corrupted_raw_file(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    target = store.path_for("raw/worldbank/countries.en.json")
    target.write_bytes(target.read_bytes() + b"x")
    with pytest.raises(IntegrityError, match="checksum mismatch"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_requires_observation_files(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    manifest = store.read_manifest()
    for code in ("NY.GDP.MKTP.CD", "SI.POV.NAHC"):
        store.path_for(f"raw/worldbank/observations/{code}.json").unlink()
    records = tuple(record for record in manifest.raw_files if "/observations/" not in record.path)
    store.write_manifest(manifest.model_copy(update={"raw_files": records}))
    with pytest.raises(IntegrityError, match="no observation files"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_rejects_missing_indicator_metadata(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    spanish = store.read_json("raw/worldbank/indicators.es.json")
    assert isinstance(spanish, list)
    _rewrite(store, "raw/worldbank/indicators.es.json", spanish[:1])
    with pytest.raises(IntegrityError, match="missing names"):
        _usecase(store).execute(tmp_path / "out.sqlite")


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("date", "not-a-year", "invalid year"),
        ("value", "not-a-number", "non-numeric"),
        ("value", True, "non-numeric"),
    ],
)
def test_build_rejects_invalid_observation_rows(
    mini_copy: Path, tmp_path: Path, field: str, value: object, message: str
) -> None:
    store = FileRawStore(mini_copy)
    relative = "raw/worldbank/observations/NY.GDP.MKTP.CD.json"
    payload = _read(store, relative)
    rows = payload["rows"]
    assert isinstance(rows, list)
    rows[0][field] = value
    _rewrite(store, relative, payload)
    with pytest.raises(IntegrityError, match=message):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_rejects_duplicate_observations(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    relative = "raw/worldbank/observations/NY.GDP.MKTP.CD.json"
    payload = _read(store, relative)
    rows = payload["rows"]
    assert isinstance(rows, list)
    rows.append(dict(rows[0]))
    _rewrite(store, relative, payload)
    with pytest.raises(IntegrityError, match="duplicate observation"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_rejects_rows_for_another_indicator(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    relative = "raw/worldbank/observations/NY.GDP.MKTP.CD.json"
    payload = _read(store, relative)
    rows = payload["rows"]
    assert isinstance(rows, list)
    rows[0]["indicator"] = {"id": "SI.POV.NAHC"}
    _rewrite(store, relative, payload)
    with pytest.raises(IntegrityError, match="contains a row for"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_skips_null_values_and_unknown_geographies(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    relative = "raw/worldbank/observations/NY.GDP.MKTP.CD.json"
    payload = _read(store, relative)
    rows = payload["rows"]
    assert isinstance(rows, list)
    rows.append(
        {
            "indicator": {"id": "NY.GDP.MKTP.CD"},
            "countryiso3code": "ECU",
            "date": "2024",
            "value": None,
        }
    )
    rows.append(
        {
            "indicator": {"id": "NY.GDP.MKTP.CD"},
            "countryiso3code": "XXX",
            "date": "2024",
            "value": 1.0,
        }
    )
    _rewrite(store, relative, payload)
    result = _usecase(store).execute(tmp_path / "out.sqlite")
    assert result.observations == 236


def test_build_rejects_missing_country_metadata(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    _rewrite(store, "raw/worldbank/countries.en.json", [])
    _rewrite(store, "raw/worldbank/countries.es.json", [])
    with pytest.raises(IntegrityError, match="no country metadata"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_rejects_bad_metadata_shapes(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    _rewrite(store, "raw/worldbank/indicators.en.json", {"not": "a list"})
    with pytest.raises(IntegrityError, match="not a list"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_rejects_non_object_metadata_entries(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    _rewrite(store, "raw/worldbank/indicators.en.json", ["bad"])
    with pytest.raises(IntegrityError, match="not an object"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_rejects_metadata_without_a_name(mini_copy: Path, tmp_path: Path) -> None:
    store = FileRawStore(mini_copy)
    english = store.read_json("raw/worldbank/indicators.en.json")
    assert isinstance(english, list)
    english[0].pop("name")
    _rewrite(store, "raw/worldbank/indicators.en.json", english)
    with pytest.raises(IntegrityError, match="has no name"):
        _usecase(store).execute(tmp_path / "out.sqlite")


def test_build_reads_urls_from_the_manifest() -> None:
    record = RawFileRecord(
        path="raw/x.json", url="https://example.test/x", bytes=1, sha256="a" * 64
    )
    assert record.url == "https://example.test/x"
