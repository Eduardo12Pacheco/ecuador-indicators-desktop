"""Build use case: raw cache to a deterministic schema-v1 snapshot."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any, cast

from pydantic import ValidationError

from ecuador_data.domain.catalog import Catalog
from ecuador_data.domain.errors import IntegrityError
from ecuador_data.domain.integrity import meta_payload, sha256_file
from ecuador_data.domain.models import (
    Dataset,
    Geography,
    Indicator,
    Observation,
    SnapshotMeta,
    SourceInfo,
)
from ecuador_data.ports import RawStore, SnapshotWriter

DEFAULT_SNAPSHOT_RELATIVE = "snapshot/ecuador-indicators.snapshot.sqlite"


@dataclass(frozen=True)
class BuildResult:
    path: str
    logical_sha256: str
    topics: int
    geographies: int
    indicators: int
    observations: int


class BuildUseCase:
    """Offline, deterministic build from the raw cache."""

    def __init__(self, *, store: RawStore, writer: SnapshotWriter, catalog: Catalog) -> None:
        self._store = store
        self._writer = writer
        self._catalog = catalog

    def execute(self, out: Path | None = None, *, update_manifest: bool = True) -> BuildResult:
        manifest = self._store.read_manifest()
        self._store.verify_raw_files(manifest)

        indicators_by_code = self._indicator_metadata()
        countries_by_iso3 = self._country_metadata()

        present_codes = [
            indicator.code
            for indicator in self._catalog.indicators
            if self._store.exists(f"raw/worldbank/observations/{indicator.code}.json")
        ]
        if not present_codes:
            raise IntegrityError("raw cache contains no observation files")

        indicators: list[Indicator] = []
        for indicator in self._catalog.indicators:
            if indicator.code not in present_codes:
                continue
            english = indicators_by_code.get(indicator.code)
            spanish = indicators_by_code.get(f"{indicator.code}:es")
            if english is None or spanish is None:
                raise IntegrityError(
                    f"raw metadata is missing names for indicator {indicator.code}"
                )
            indicators.append(
                Indicator(
                    code=indicator.code,
                    topic_id=indicator.topic_id,
                    name_en=self._required_text(english, "name", indicator.code),
                    name_es=self._spanish_text(
                        spanish, "name", indicator.code, indicator.fallback_name_es
                    ),
                    description_en=str(english.get("sourceNote", "") or ""),
                    description_es=self._optional_spanish_text(
                        spanish, "sourceNote", indicator.fallback_description_es
                    ),
                    unit_en=indicator.unit_en,
                    unit_es=indicator.unit_es,
                    value_kind=indicator.value_kind,
                    decimals=indicator.decimals,
                    higher_is=indicator.higher_is,
                    source_org_en=str(english.get("sourceOrganization", "") or ""),
                    source_org_es=self._optional_spanish_text(
                        spanish, "sourceOrganization", indicator.fallback_source_org_es
                    ),
                    sort_order=indicator.sort_order,
                )
            )

        geographies: list[Geography] = []
        for geography in self._catalog.geographies:
            country_en = countries_by_iso3.get(geography.iso3)
            country_es = countries_by_iso3.get(f"{geography.iso3}:es")
            if country_en is None or country_es is None:
                continue
            geographies.append(
                geography.model_copy(
                    update={
                        "iso2": self._required_text(country_en, "iso2Code", geography.iso3),
                        "name_en": self._required_text(country_en, "name", geography.iso3),
                        "name_es": self._required_text(country_es, "name", geography.iso3),
                    }
                )
            )
        if not geographies:
            raise IntegrityError("raw cache contains no country metadata")

        known_geographies = {geography.iso3 for geography in geographies}
        observations = self._observations(present_codes, known_geographies)

        source = SourceInfo(
            dataset_id=manifest.dataset.id,
            dataset_version=manifest.dataset.version,
            name=manifest.source.name,
            publisher=manifest.source.publisher,
            api=manifest.source.api,
            source_id=manifest.source.source_id,
            source_last_updated=manifest.source.source_last_updated,
            license=manifest.source.license,
            license_url=manifest.source.license_url,
            terms_url=manifest.source.terms_url,
            retrieved_at=manifest.retrieved_at,
        )
        dataset = Dataset(
            topics=tuple(self._catalog.topics),
            geographies=tuple(geographies),
            indicators=tuple(indicators),
            observations=tuple(observations),
            source=source,
        )
        meta = meta_payload(source)
        target = Path(out) if out is not None else self._store.data_dir / DEFAULT_SNAPSHOT_RELATIVE
        logical = self._writer.write(dataset, meta, target)
        counts = dataset.counts()

        canonical = (self._store.data_dir / DEFAULT_SNAPSHOT_RELATIVE).resolve()
        if update_manifest and target.resolve() == canonical:
            snapshot_meta = SnapshotMeta(
                path=DEFAULT_SNAPSHOT_RELATIVE,
                schema_version=1,
                sha256=sha256_file(target),
                logical_sha256=logical,
                counts=counts,
            )
            self._store.write_manifest(manifest.model_copy(update={"snapshot": snapshot_meta}))

        return BuildResult(
            path=str(target),
            logical_sha256=logical,
            topics=counts.topics,
            geographies=counts.geographies,
            indicators=counts.indicators,
            observations=counts.observations,
        )

    # -- raw metadata -------------------------------------------------------
    def _indicator_metadata(self) -> dict[str, dict[str, Any]]:
        english = self._metadata_list("raw/worldbank/indicators.en.json")
        spanish = self._metadata_list("raw/worldbank/indicators.es.json")
        merged: dict[str, dict[str, Any]] = {}
        for entry in english:
            merged[self._required_text(entry, "id", "indicator")] = entry
        for entry in spanish:
            code = self._required_text(entry, "id", "indicator")
            merged[f"{code}:es"] = entry
        return merged

    def _country_metadata(self) -> dict[str, dict[str, Any]]:
        english = self._metadata_list("raw/worldbank/countries.en.json")
        spanish = self._metadata_list("raw/worldbank/countries.es.json")
        merged: dict[str, dict[str, Any]] = {}
        for entry in english:
            merged[self._required_text(entry, "id", "country")] = entry
        for entry in spanish:
            iso3 = self._required_text(entry, "id", "country")
            merged[f"{iso3}:es"] = entry
        return merged

    def _metadata_list(self, relative_path: str) -> list[dict[str, Any]]:
        payload = self._store.read_json(relative_path)
        if not isinstance(payload, list):
            raise IntegrityError(f"raw metadata file is not a list: {relative_path}")
        entries: list[dict[str, Any]] = []
        for item in payload:
            if not isinstance(item, dict):
                raise IntegrityError(f"raw metadata entry is not an object: {relative_path}")
            entries.append(cast(dict[str, Any], item))
        return entries

    @staticmethod
    def _required_text(entry: dict[str, Any], key: str, label: str) -> str:
        value = entry.get(key)
        if not isinstance(value, str) or not value:
            raise IntegrityError(f"raw metadata for {label} has no {key}")
        return value

    @staticmethod
    def _spanish_text(entry: dict[str, Any], key: str, label: str, fallback: str | None) -> str:
        value = entry.get(key)
        if isinstance(value, str) and value:
            return value
        if fallback:
            return fallback
        raise IntegrityError(f"raw metadata for {label} has no {key}")

    @staticmethod
    def _optional_spanish_text(entry: dict[str, Any], key: str, fallback: str | None) -> str:
        value = entry.get(key)
        if isinstance(value, str) and value:
            return value
        return fallback or ""

    # -- observations -------------------------------------------------------
    def _observations(self, codes: list[str], known_geographies: set[str]) -> list[Observation]:
        observations: list[Observation] = []
        seen: set[tuple[str, str, int]] = set()
        for code in codes:
            for row in self._observation_rows(code):
                observation = self._parse_row(code, row, known_geographies, seen)
                if observation is not None:
                    observations.append(observation)
        observations.sort(key=lambda item: (item.indicator_code, item.iso3, item.year))
        return observations

    def _observation_rows(self, code: str) -> list[dict[str, Any]]:
        payload = self._store.read_json(f"raw/worldbank/observations/{code}.json")
        if not isinstance(payload, dict):
            raise IntegrityError(f"observation file is not an object: {code}")
        rows = payload.get("rows")
        if not isinstance(rows, list):
            raise IntegrityError(f"observation file has no rows list: {code}")
        parsed: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, dict):
                raise IntegrityError(f"observation row is not an object: {code}")
            parsed.append(cast(dict[str, Any], row))
        return parsed

    @staticmethod
    def _parse_row(
        code: str,
        row: dict[str, Any],
        known_geographies: set[str],
        seen: set[tuple[str, str, int]],
    ) -> Observation | None:
        value = row.get("value")
        if value is None:
            return None
        iso3 = str(row.get("countryiso3code", ""))
        if iso3 not in known_geographies:
            return None
        indicator = row.get("indicator")
        row_code = indicator.get("id") if isinstance(indicator, dict) else None
        if row_code != code:
            raise IntegrityError(f"observation file {code} contains a row for {row_code!r}")
        try:
            year = int(str(row.get("date", "")))
        except ValueError as exc:
            raise IntegrityError(f"observation for {code} has an invalid year") from exc
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise IntegrityError(f"observation for {code} has a non-numeric value")
        numeric = float(value)
        if not math.isfinite(numeric):
            raise IntegrityError(f"observation for {code} has a non-finite value")
        key = (code, iso3, year)
        if key in seen:
            raise IntegrityError(f"duplicate observation for {code}/{iso3}/{year}")
        seen.add(key)
        try:
            return Observation(indicator_code=code, iso3=iso3, year=year, value=numeric)
        except ValidationError as exc:
            raise IntegrityError(f"invalid observation: {exc}") from exc
