"""Ports implemented by the pipeline adapters."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from pathlib import Path
from typing import Protocol

from ecuador_data.domain.manifest import LakehouseImport
from ecuador_data.domain.models import (
    Dataset,
    ObservationPage,
    RawFileRecord,
    RawManifest,
    SnapshotRead,
)


class Clock(Protocol):
    """Source of the current time, injected so tests stay deterministic."""

    def now(self) -> datetime: ...


class IndicatorSource(Protocol):
    """Upstream catalog and observation source."""

    def fetch_indicators(
        self, codes: Sequence[str], *, language: str
    ) -> list[dict[str, object]]: ...

    def fetch_countries(
        self, iso3s: Sequence[str], *, language: str
    ) -> list[dict[str, object]]: ...

    def fetch_observations(
        self, codes: Sequence[str], iso3s: Sequence[str], *, language: str = "en"
    ) -> Mapping[str, ObservationPage]: ...


class RawStore(Protocol):
    """Raw cache plus the data manifest."""

    @property
    def data_dir(self) -> Path: ...

    def write_json(self, relative_path: str, payload: object, *, url: str) -> RawFileRecord: ...

    def read_json(self, relative_path: str) -> object: ...

    def exists(self, relative_path: str) -> bool: ...

    def path_for(self, relative_path: str) -> Path: ...

    def write_manifest(self, manifest: RawManifest) -> Path: ...

    def read_manifest(self) -> RawManifest: ...

    def verify_raw_files(self, manifest: RawManifest) -> None: ...


class SnapshotWriter(Protocol):
    """Writes and reads back the bundled SQLite snapshot."""

    def write(self, dataset: Dataset, meta: Mapping[str, str], path: Path) -> str: ...

    def read(self, path: Path) -> SnapshotRead: ...


class LakehouseSource(Protocol):
    """Reads a snapshot dataset from a lakehouse DuckDB export."""

    def read(self, manifest_path: Path) -> LakehouseImport: ...


class JsonExporter(Protocol):
    """Writes the JSON snapshot consumed by the in-memory adapter."""

    def write(self, dataset: Dataset, meta: Mapping[str, str], path: Path) -> int: ...
