"""Unit tests for the file raw cache adapter."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.domain.errors import IntegrityError, ManifestError
from ecuador_data.domain.integrity import canonical_json_bytes

MANIFEST = {
    "manifest_version": 1,
    "dataset": {"id": "ecuador-indicators", "version": "2026-11-20", "title": "Test"},
    "source": {
        "name": "World Development Indicators",
        "publisher": "The World Bank",
        "api": "https://api.worldbank.org/v2",
        "source_id": "2",
        "source_last_updated": "2026-11-11",
        "license": "CC-BY-4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "terms_url": "https://datacatalog.worldbank.org/public-licenses",
    },
    "retrieved_at": "2026-11-20T00:00:00+00:00",
    "raw_files": [],
}


def _store(tmp_path: Path) -> FileRawStore:
    store = FileRawStore(tmp_path)
    (tmp_path / "MANIFEST.json").write_bytes(canonical_json_bytes(MANIFEST))
    return store


def test_write_json_is_canonical_and_records_the_checksum(tmp_path: Path) -> None:
    store = _store(tmp_path)
    record = store.write_json("raw/worldbank/x.json", {"b": 1, "a": "ñ"}, url="https://x.test")
    target = tmp_path / "raw" / "worldbank" / "x.json"
    assert target.read_bytes() == b'{"a":"\xc3\xb1","b":1}\n'
    assert record.path == "raw/worldbank/x.json"
    assert record.bytes == len(target.read_bytes())
    assert len(record.sha256) == 64
    assert store.read_json("raw/worldbank/x.json") == {"a": "ñ", "b": 1}
    assert store.exists("raw/worldbank/x.json") is True
    assert store.path_for("raw/worldbank/x.json") == target


@pytest.mark.parametrize("path", ["/etc/passwd", "../escape.json", "raw/../../escape.json"])
def test_rejects_unsafe_paths(tmp_path: Path, path: str) -> None:
    store = _store(tmp_path)
    with pytest.raises(ManifestError, match="unsafe raw cache path"):
        store.write_json(path, {}, url="https://x.test")


def test_read_json_reports_missing_and_invalid_files(tmp_path: Path) -> None:
    store = _store(tmp_path)
    with pytest.raises(IntegrityError, match="raw file not found"):
        store.read_json("raw/missing.json")
    target = tmp_path / "raw" / "broken.json"
    target.parent.mkdir(parents=True)
    target.write_text("{", encoding="utf-8")
    with pytest.raises(IntegrityError, match="not valid JSON"):
        store.read_json("raw/broken.json")


def test_manifest_round_trip(tmp_path: Path) -> None:
    store = _store(tmp_path)
    manifest = store.read_manifest()
    assert manifest.dataset.id == "ecuador-indicators"
    assert manifest.snapshot is None
    store.write_manifest(manifest)
    assert json.loads((tmp_path / "MANIFEST.json").read_text())["manifest_version"] == 1


def test_read_manifest_reports_missing_and_invalid_json(tmp_path: Path) -> None:
    store = FileRawStore(tmp_path)
    with pytest.raises(ManifestError, match="manifest not found"):
        store.read_manifest()
    (tmp_path / "MANIFEST.json").write_text("{", encoding="utf-8")
    with pytest.raises(ManifestError, match="not valid JSON"):
        store.read_manifest()


def test_read_manifest_reports_invalid_shape(tmp_path: Path) -> None:
    store = _store(tmp_path)
    (tmp_path / "MANIFEST.json").write_text('{"manifest_version": 2}', encoding="utf-8")
    with pytest.raises(ManifestError, match="manifest is invalid"):
        store.read_manifest()


def test_verify_raw_files_detects_missing_size_and_hash(tmp_path: Path) -> None:
    store = _store(tmp_path)
    record = store.write_json("raw/x.json", {"a": 1}, url="https://x.test")
    manifest = store.read_manifest()
    manifest = manifest.model_copy(update={"raw_files": (record,)})
    store.verify_raw_files(manifest)

    (tmp_path / "raw" / "x.json").unlink()
    with pytest.raises(IntegrityError, match="raw file missing"):
        store.verify_raw_files(manifest)

    store.write_json("raw/x.json", {"a": 1}, url="https://x.test")
    with pytest.raises(IntegrityError, match="checksum mismatch"):
        store.verify_raw_files(
            manifest.model_copy(
                update={"raw_files": (record.model_copy(update={"bytes": record.bytes + 1}),)}
            )
        )

    with pytest.raises(IntegrityError, match="checksum mismatch"):
        store.verify_raw_files(
            manifest.model_copy(
                update={"raw_files": (record.model_copy(update={"sha256": "b" * 64}),)}
            )
        )
