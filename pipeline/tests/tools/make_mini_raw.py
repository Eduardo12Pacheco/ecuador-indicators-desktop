"""Regenerate the ``mini_raw`` fixture tree and its snapshot from the recorded fixtures.

Run from the pipeline directory after changing the recorded fixtures::

    uv run python tests/tools/make_mini_raw.py
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, cast

from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.application.build import BuildUseCase
from ecuador_data.domain.catalog import load_catalog
from ecuador_data.domain.integrity import sha256_bytes
from ecuador_data.domain.models import (
    DatasetMeta,
    RawFileRecord,
    RawManifest,
    SourceMeta,
)

TESTS_DIR = Path(__file__).resolve().parents[1]
FIXTURES = TESTS_DIR / "fixtures" / "worldbank"
MINI_RAW = TESTS_DIR / "fixtures" / "mini_raw"
API_ROOT = "https://api.worldbank.org/v2"
CODES = ("NY.GDP.MKTP.CD", "SI.POV.NAHC")
GEOS = ("ECU", "COL", "LCN")
RETRIEVED_AT = "2026-11-20T06:12:38+00:00"
SOURCE_LAST_UPDATED = "2026-11-11"


def _read(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _entries(name: str) -> list[dict[str, Any]]:
    payload = _read(name)
    return [cast(dict[str, Any], entry) for entry in payload[1]]


def _write_metadata(store: FileRawStore) -> list[RawFileRecord]:
    records: list[RawFileRecord] = []
    for language in ("en", "es"):
        prefix = "/es" if language == "es" else ""
        indicators = [
            entry for code in CODES for entry in _entries(f"indicator_{code}.{language}.json")
        ]
        records.append(
            store.write_json(
                f"raw/worldbank/indicators.{language}.json",
                indicators,
                url=f"{API_ROOT}{prefix}/indicator/{';'.join(CODES)}",
            )
        )
    for language in ("en", "es"):
        prefix = "/es" if language == "es" else ""
        records.append(
            store.write_json(
                f"raw/worldbank/countries.{language}.json",
                _entries(f"countries.{language}.json"),
                url=f"{API_ROOT}{prefix}/country/{';'.join(GEOS)}",
            )
        )
    return records


def _write_observations(store: FileRawStore) -> list[RawFileRecord]:
    records: list[RawFileRecord] = []
    for code in CODES:
        payload = _read(f"observations_{code}.json")
        meta = cast(dict[str, Any], payload[0])
        rows = [row for row in payload[1] if row.get("value") is not None]
        rows.sort(key=lambda row: (str(row.get("countryiso3code", "")), str(row.get("date", ""))))
        url = f"{API_ROOT}/country/{';'.join(GEOS)}/indicator/{code}"
        records.append(
            store.write_json(
                f"raw/worldbank/observations/{code}.json",
                {
                    "request": {"url": url, "retrieved_at": RETRIEVED_AT},
                    "meta": {
                        "source_id": str(meta.get("sourceid", "")),
                        "lastupdated": str(meta.get("lastupdated", "")),
                    },
                    "rows": rows,
                },
                url=url,
            )
        )
    return records


def main() -> None:
    if MINI_RAW.exists():
        for path in sorted(MINI_RAW.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            elif path.is_dir():
                path.rmdir()
    store = FileRawStore(MINI_RAW)
    records = _write_metadata(store) + _write_observations(store)
    records.sort(key=lambda record: record.path)
    manifest = RawManifest(
        dataset=DatasetMeta(
            id="ecuador-indicators", version="2026-11-20", title="Mini raw fixture"
        ),
        source=SourceMeta(
            name="World Development Indicators",
            publisher="The World Bank",
            api=API_ROOT,
            source_id="2",
            source_last_updated=SOURCE_LAST_UPDATED,
            license="CC-BY-4.0",
            license_url="https://creativecommons.org/licenses/by/4.0/",
            terms_url="https://datacatalog.worldbank.org/public-licenses",
        ),
        retrieved_at=RETRIEVED_AT,
        raw_files=tuple(records),
    )
    store.write_manifest(manifest)
    result = BuildUseCase(
        store=store, writer=SqliteSnapshotWriter(), catalog=load_catalog()
    ).execute()
    print(f"built {result.path} logical_sha256={result.logical_sha256}")
    for record in records:
        path = store.path_for(record.path)
        assert sha256_bytes(path.read_bytes()) == record.sha256


if __name__ == "__main__":
    main()
