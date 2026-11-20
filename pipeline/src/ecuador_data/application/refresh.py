"""Refresh use case: World Bank API to the raw cache and manifest."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from ecuador_data.domain.catalog import Catalog
from ecuador_data.domain.errors import SourceProtocolError
from ecuador_data.domain.models import (
    DatasetMeta,
    ObservationPage,
    RawFileRecord,
    RawManifest,
    SourceMeta,
)
from ecuador_data.ports import Clock, IndicatorSource, RawStore

API_ROOT = "https://api.worldbank.org/v2"
DATASET_ID = "ecuador-indicators"
DATASET_TITLE = "Ecuador Indicators snapshot"
SOURCE_NAME = "World Development Indicators"
SOURCE_PUBLISHER = "The World Bank"
SOURCE_ID = "2"
LICENSE = "CC-BY-4.0"
LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
TERMS_URL = "https://datacatalog.worldbank.org/public-licenses"


@dataclass(frozen=True)
class RefreshResult:
    raw_files: int
    retrieved_at: str
    source_last_updated: str
    manifest_path: str


class RefreshUseCase:
    """Fetches metadata in both languages and observations, then writes the manifest."""

    def __init__(
        self,
        *,
        source: IndicatorSource,
        store: RawStore,
        clock: Clock,
        catalog: Catalog,
    ) -> None:
        self._source = source
        self._store = store
        self._clock = clock
        self._catalog = catalog

    def execute(self) -> RefreshResult:
        codes = list(self._catalog.indicator_codes())
        geographies = list(self._catalog.geography_codes())
        records: list[RawFileRecord] = []

        indicators_en = self._source.fetch_indicators(codes, language="en")
        records.append(
            self._store.write_json(
                "raw/worldbank/indicators.en.json",
                indicators_en,
                url=f"{API_ROOT}/indicator/{';'.join(codes)}",
            )
        )
        indicators_es = self._source.fetch_indicators(codes, language="es")
        records.append(
            self._store.write_json(
                "raw/worldbank/indicators.es.json",
                indicators_es,
                url=f"{API_ROOT}/es/indicator/{';'.join(codes)}",
            )
        )

        countries_en = self._source.fetch_countries(geographies, language="en")
        records.append(
            self._store.write_json(
                "raw/worldbank/countries.en.json",
                countries_en,
                url=f"{API_ROOT}/country/{';'.join(geographies)}",
            )
        )
        countries_es = self._source.fetch_countries(geographies, language="es")
        records.append(
            self._store.write_json(
                "raw/worldbank/countries.es.json",
                countries_es,
                url=f"{API_ROOT}/es/country/{';'.join(geographies)}",
            )
        )

        pages = self._source.fetch_observations(codes, geographies)
        source_last_updated = ""
        retrieved_at = ""
        for code in codes:
            page = pages.get(code)
            if page is None:
                raise SourceProtocolError(f"no observation page returned for {code}")
            payload = self._observation_payload(page)
            records.append(
                self._store.write_json(
                    f"raw/worldbank/observations/{code}.json",
                    payload,
                    url=page.url,
                )
            )
            if not source_last_updated and page.last_updated:
                source_last_updated = page.last_updated
            if not retrieved_at and page.retrieved_at:
                retrieved_at = page.retrieved_at

        if not retrieved_at:
            retrieved_at = self._clock.now().isoformat(timespec="seconds")
        if not source_last_updated:
            raise SourceProtocolError("World Bank API did not report a lastupdated value")

        manifest = RawManifest(
            dataset=DatasetMeta(
                id=DATASET_ID,
                version=retrieved_at[:10],
                title=DATASET_TITLE,
            ),
            source=SourceMeta(
                name=SOURCE_NAME,
                publisher=SOURCE_PUBLISHER,
                api=API_ROOT,
                source_id=SOURCE_ID,
                source_last_updated=source_last_updated,
                license=LICENSE,
                license_url=LICENSE_URL,
                terms_url=TERMS_URL,
            ),
            retrieved_at=retrieved_at,
            raw_files=tuple(sorted(records, key=lambda record: record.path)),
        )
        manifest_path = self._store.write_manifest(manifest)
        return RefreshResult(
            raw_files=len(manifest.raw_files),
            retrieved_at=retrieved_at,
            source_last_updated=source_last_updated,
            manifest_path=str(manifest_path),
        )

    @staticmethod
    def _observation_payload(page: ObservationPage) -> dict[str, Any]:
        rows: list[dict[str, object]] = [cast(dict[str, object], dict(row)) for row in page.rows]
        return {
            "request": {"url": page.url, "retrieved_at": page.retrieved_at},
            "meta": {"source_id": page.source_id, "lastupdated": page.last_updated},
            "rows": rows,
        }
