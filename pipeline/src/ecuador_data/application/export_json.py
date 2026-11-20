"""Export use case: deterministic JSON from the raw cache."""

from __future__ import annotations

import tempfile
from dataclasses import dataclass
from pathlib import Path

from ecuador_data.application.build import BuildUseCase
from ecuador_data.domain.catalog import Catalog
from ecuador_data.ports import JsonExporter, RawStore, SnapshotWriter


@dataclass(frozen=True)
class ExportJsonResult:
    path: str
    topics: int
    geographies: int
    indicators: int
    observations: int
    bytes: int


class ExportJsonUseCase:
    """Builds the selected catalog offline and writes the JSON fixture shape."""

    def __init__(
        self,
        *,
        store: RawStore,
        writer: SnapshotWriter,
        exporter: JsonExporter,
        catalog: Catalog,
    ) -> None:
        self._store = store
        self._writer = writer
        self._exporter = exporter
        self._catalog = catalog

    def execute(self, out: Path) -> ExportJsonResult:
        target = Path(out)
        with tempfile.TemporaryDirectory(prefix="ecuador-export-") as directory:
            snapshot = Path(directory) / "export.sqlite"
            BuildUseCase(store=self._store, writer=self._writer, catalog=self._catalog).execute(
                snapshot, update_manifest=False
            )
            read = self._writer.read(snapshot)
            size = self._exporter.write(read.dataset, read.meta, target)
        counts = read.dataset.counts()
        return ExportJsonResult(
            path=str(target),
            topics=counts.topics,
            geographies=counts.geographies,
            indicators=counts.indicators,
            observations=counts.observations,
            bytes=size,
        )
