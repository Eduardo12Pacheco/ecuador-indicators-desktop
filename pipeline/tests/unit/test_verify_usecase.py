"""Unit tests for the verify use case."""

from __future__ import annotations

from pathlib import Path

import pytest

from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.application.verify import VerifyResult, VerifyUseCase
from ecuador_data.domain.errors import IntegrityError, ManifestError
from ecuador_data.domain.models import SnapshotRead


def _usecase(store: FileRawStore, writer: SqliteSnapshotWriter | None = None) -> VerifyUseCase:
    return VerifyUseCase(store=store, writer=writer or SqliteSnapshotWriter())


def test_verify_accepts_the_committed_fixture(mini_copy: Path) -> None:
    result = _usecase(FileRawStore(mini_copy)).execute()
    assert isinstance(result, VerifyResult)
    assert (result.topics, result.geographies, result.indicators, result.observations) == (
        8,
        3,
        2,
        236,
    )
    assert len(result.logical_sha256) == 64
    assert len(result.snapshot_sha256) == 64


def test_verify_detects_a_mutated_raw_file(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    target = store.path_for("raw/worldbank/observations/SI.POV.NAHC.json")
    target.write_bytes(target.read_bytes() + b"x")
    with pytest.raises(IntegrityError, match=r"checksum mismatch: raw/"):
        _usecase(store).execute()


def test_verify_requires_a_snapshot_section(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    manifest = store.read_manifest()
    store.write_manifest(manifest.model_copy(update={"snapshot": None}))
    with pytest.raises(ManifestError, match="no snapshot section"):
        _usecase(store).execute()


def test_verify_reports_a_missing_snapshot(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    store.path_for("snapshot/ecuador-indicators.snapshot.sqlite").unlink()
    with pytest.raises(IntegrityError, match="snapshot not found"):
        _usecase(store).execute()


def test_verify_detects_a_mutated_snapshot_file(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    target = store.path_for("snapshot/ecuador-indicators.snapshot.sqlite")
    target.write_bytes(target.read_bytes() + b"x")
    with pytest.raises(IntegrityError, match="checksum mismatch: snapshot/"):
        _usecase(store).execute()


def test_verify_detects_count_mismatches(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    manifest = store.read_manifest()
    assert manifest.snapshot is not None
    snapshot = manifest.snapshot.model_copy(
        update={"counts": manifest.snapshot.counts.model_copy(update={"observations": 1})}
    )
    store.write_manifest(manifest.model_copy(update={"snapshot": snapshot}))
    with pytest.raises(IntegrityError, match="snapshot count mismatch"):
        _usecase(store).execute()


def test_verify_detects_a_recorded_logical_hash_mismatch(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    manifest = store.read_manifest()
    assert manifest.snapshot is not None
    snapshot = manifest.snapshot.model_copy(update={"logical_sha256": "a" * 64})
    store.write_manifest(manifest.model_copy(update={"snapshot": snapshot}))
    with pytest.raises(IntegrityError, match="logical hash mismatch"):
        _usecase(store).execute()


def test_verify_detects_a_recomputed_logical_hash_mismatch(mini_copy: Path) -> None:
    class TamperingWriter(SqliteSnapshotWriter):
        def read(self, path: Path) -> SnapshotRead:
            read = super().read(path)
            observations = list(read.dataset.observations)
            last = observations[-1]
            observations[-1] = last.model_copy(update={"value": last.value + 1.0})
            dataset = read.dataset.model_copy(update={"observations": tuple(observations)})
            return SnapshotRead(dataset=dataset, meta=read.meta)

    with pytest.raises(IntegrityError, match="logical hash mismatch"):
        VerifyUseCase(store=FileRawStore(mini_copy), writer=TamperingWriter()).execute()


def test_verify_rejects_an_unsafe_snapshot_path(mini_copy: Path) -> None:
    store = FileRawStore(mini_copy)
    manifest = store.read_manifest()
    assert manifest.snapshot is not None
    snapshot = manifest.snapshot.model_copy(update={"path": "../escape.sqlite"})
    store.write_manifest(manifest.model_copy(update={"snapshot": snapshot}))
    with pytest.raises(ManifestError, match="unsafe raw cache path"):
        _usecase(store).execute()
