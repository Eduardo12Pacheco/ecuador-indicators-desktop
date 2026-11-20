"""Import use case: lakehouse DuckDB to a schema-v1 snapshot."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ecuador_data.domain.integrity import meta_payload
from ecuador_data.ports import LakehouseSource, SnapshotWriter


@dataclass(frozen=True)
class ImportLakehouseResult:
    path: str
    logical_sha256: str
    topics: int
    geographies: int
    indicators: int
    observations: int


class ImportLakehouseUseCase:
    """Validates the manifest, reads the DuckDB export and writes a snapshot."""

    def __init__(self, *, source: LakehouseSource, writer: SnapshotWriter) -> None:
        self._source = source
        self._writer = writer

    def execute(self, manifest_path: Path, out: Path) -> ImportLakehouseResult:
        imported = self._source.read(Path(manifest_path))
        dataset = imported.dataset
        manifest = imported.manifest
        meta = meta_payload(dataset.source, origin="lakehouse")
        meta["attribution_en"] = manifest.license.attribution_en
        meta["attribution_es"] = manifest.license.attribution_es
        target = Path(out)
        logical = self._writer.write(dataset, meta, target)
        counts = dataset.counts()
        return ImportLakehouseResult(
            path=str(target),
            logical_sha256=logical,
            topics=counts.topics,
            geographies=counts.geographies,
            indicators=counts.indicators,
            observations=counts.observations,
        )
