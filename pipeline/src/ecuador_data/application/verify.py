"""Verify use case: raw checksums, snapshot schema, counts and hashes."""

from __future__ import annotations

from dataclasses import dataclass

from ecuador_data.domain.errors import IntegrityError, ManifestError
from ecuador_data.domain.integrity import dataset_logical_sha256, sha256_file
from ecuador_data.ports import RawStore, SnapshotWriter


@dataclass(frozen=True)
class VerifyResult:
    topics: int
    geographies: int
    indicators: int
    observations: int
    logical_sha256: str
    snapshot_sha256: str


class VerifyUseCase:
    """Checks that the raw cache and the snapshot are the recorded artifacts."""

    def __init__(self, *, store: RawStore, writer: SnapshotWriter) -> None:
        self._store = store
        self._writer = writer

    def execute(self) -> VerifyResult:
        manifest = self._store.read_manifest()
        self._store.verify_raw_files(manifest)
        if manifest.snapshot is None:
            raise ManifestError("data manifest has no snapshot section; run `ecuador-data build`")

        snapshot_path = self._store.path_for(manifest.snapshot.path)
        if not snapshot_path.is_file():
            raise IntegrityError(f"snapshot not found: {manifest.snapshot.path}")
        actual_file_hash = sha256_file(snapshot_path)
        if actual_file_hash != manifest.snapshot.sha256:
            raise IntegrityError(
                f"checksum mismatch: {manifest.snapshot.path} "
                f"expected={manifest.snapshot.sha256} actual={actual_file_hash}"
            )

        read = self._writer.read(snapshot_path)
        counts = read.dataset.counts()
        recorded = manifest.snapshot.counts
        differences = [
            f"{field}: expected {expected}, found {found}"
            for field, expected, found in (
                ("topics", recorded.topics, counts.topics),
                ("geographies", recorded.geographies, counts.geographies),
                ("indicators", recorded.indicators, counts.indicators),
                ("observations", recorded.observations, counts.observations),
            )
            if expected != found
        ]
        if differences:
            raise IntegrityError(
                f"snapshot count mismatch in {manifest.snapshot.path}: " + "; ".join(differences)
            )

        recorded_logical = manifest.snapshot.logical_sha256
        stored_logical = read.meta.get("logical_sha256", "")
        if stored_logical != recorded_logical:
            raise IntegrityError(
                f"logical hash mismatch: expected={recorded_logical} actual={stored_logical}"
            )
        recomputed = dataset_logical_sha256(read.dataset, read.meta)
        if recomputed != recorded_logical:
            raise IntegrityError(
                f"logical hash mismatch: expected={recorded_logical} actual={recomputed}"
            )

        return VerifyResult(
            topics=counts.topics,
            geographies=counts.geographies,
            indicators=counts.indicators,
            observations=counts.observations,
            logical_sha256=recorded_logical,
            snapshot_sha256=actual_file_hash,
        )
