"""JSON snapshot exporter for the in-memory adapter and test fixtures."""

from __future__ import annotations

import os
import tempfile
from collections.abc import Mapping
from pathlib import Path

from ecuador_data.domain.integrity import LOGICAL_HASH_KEY, canonical_json_bytes
from ecuador_data.domain.models import Dataset

SCHEMA_VERSION = 1


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        temp_path.replace(path)
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise


class JsonSnapshotExporter:
    """Writes deterministic JSON in the shape consumed by the memory adapter."""

    def write(self, dataset: Dataset, meta: Mapping[str, str], path: Path) -> int:
        payload = {
            "schema_version": SCHEMA_VERSION,
            "meta": {key: value for key, value in meta.items() if key != LOGICAL_HASH_KEY},
            "topics": [
                topic.model_dump(mode="json")
                for topic in sorted(dataset.topics, key=lambda item: item.id)
            ],
            "geographies": [
                geography.model_dump(mode="json")
                for geography in sorted(dataset.geographies, key=lambda item: item.iso3)
            ],
            "indicators": [
                indicator.model_dump(mode="json")
                for indicator in sorted(dataset.indicators, key=lambda item: item.code)
            ],
            "observations": [
                [observation.indicator_code, observation.iso3, observation.year, observation.value]
                for observation in sorted(
                    dataset.observations,
                    key=lambda item: (item.indicator_code, item.iso3, item.year),
                )
            ],
        }
        data = canonical_json_bytes(payload)
        _atomic_write(Path(path), data)
        return len(data)
