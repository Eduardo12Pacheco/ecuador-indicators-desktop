"""DuckDB lakehouse source adapter (manifest v1).

The desktop runtime never links DuckDB; this adapter only runs in the Python
pipeline, behind the optional ``lakehouse`` extra. The DuckDB file is opened
read-only and every relation and column is addressed through an identifier that
the domain manifest already validated, so there is no SQL injection surface.
"""

from __future__ import annotations

import importlib
import json
from collections.abc import Mapping
from pathlib import Path, PurePosixPath
from typing import Any, cast

from pydantic import ValidationError

from ecuador_data.domain.errors import ManifestError
from ecuador_data.domain.integrity import sha256_file
from ecuador_data.domain.manifest import (
    REQUIRED_COLUMNS,
    LakehouseImport,
    LakehouseManifest,
    TableMapping,
    parse_manifest,
)
from ecuador_data.domain.models import (
    Dataset,
    Geography,
    Indicator,
    Observation,
    SourceInfo,
    Topic,
)


def _quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _quote_relation(relation: str) -> str:
    return ".".join(_quote(part) for part in relation.split("."))


def _import_duckdb() -> Any:
    try:
        return cast(Any, importlib.import_module("duckdb"))
    except ImportError as exc:  # pragma: no cover - exercised through the CLI extra
        raise ManifestError(
            "duckdb is not installed; install the lakehouse extra with `uv sync --extra lakehouse`"
        ) from exc


class LakehouseDuckDbSource:
    """``LakehouseSource`` over a read-only DuckDB file plus its JSON manifest."""

    def read(self, manifest_path: Path) -> LakehouseImport:
        path = Path(manifest_path)
        manifest = parse_manifest(self._read_json(path))
        duckdb_path = self._resolve_duckdb_path(path, manifest)
        if not duckdb_path.is_file():
            raise ManifestError(f"lakehouse duckdb not found: {manifest.duckdb.path}")
        actual = sha256_file(duckdb_path)
        if actual != manifest.duckdb.sha256:
            raise ManifestError(
                f"lakehouse duckdb checksum mismatch: {manifest.duckdb.path} "
                f"expected={manifest.duckdb.sha256} actual={actual}"
            )
        duckdb = _import_duckdb()
        try:
            connection = duckdb.connect(str(duckdb_path), read_only=True)
        except Exception as exc:
            raise ManifestError(
                f"lakehouse duckdb cannot be opened: {manifest.duckdb.path}: {exc}"
            ) from exc
        try:
            dataset = self._read_dataset(connection, manifest)
        finally:
            connection.close()
        return LakehouseImport(dataset=dataset, manifest=manifest)

    # -- manifest -----------------------------------------------------------
    @staticmethod
    def _read_json(path: Path) -> object:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise ManifestError(f"lakehouse manifest not found: {path.name}") from exc
        except json.JSONDecodeError as exc:
            raise ManifestError(f"lakehouse manifest is not valid JSON: {exc}") from exc
        except OSError as exc:
            raise ManifestError(f"lakehouse manifest cannot be read: {exc}") from exc

    @staticmethod
    def _resolve_duckdb_path(manifest_path: Path, manifest: LakehouseManifest) -> Path:
        candidate = PurePosixPath(manifest.duckdb.path)
        if candidate.is_absolute() or ".." in candidate.parts:
            raise ManifestError(
                f"lakehouse duckdb path must be relative to the manifest: {manifest.duckdb.path}"
            )
        return manifest_path.parent.joinpath(*candidate.parts)

    # -- duckdb -------------------------------------------------------------
    def _read_dataset(self, connection: Any, manifest: LakehouseManifest) -> Dataset:
        relations = manifest.relations
        topics = self._topics(self._fetch(connection, relations.topics, "id"))
        geographies = self._geographies(self._fetch(connection, relations.geographies, "iso3"))
        indicators = self._indicators(self._fetch(connection, relations.indicators, "code"))
        observations = self._observations(
            self._fetch(
                connection,
                relations.observations,
                "indicator_code",
                "iso3",
                "year",
            )
        )
        self._check_references(topics, geographies, indicators, observations)
        source = SourceInfo(
            dataset_id=manifest.dataset.id,
            dataset_version=manifest.dataset.version,
            name=manifest.dataset.title,
            publisher="Lakehouse",
            api="lakehouse",
            source_id="lakehouse",
            source_last_updated=manifest.generated_at,
            license=manifest.license.spdx,
            license_url=manifest.license.url,
            terms_url=manifest.license.url,
            retrieved_at=manifest.generated_at,
        )
        return Dataset(
            topics=topics,
            geographies=geographies,
            indicators=indicators,
            observations=observations,
            source=source,
        )

    @staticmethod
    def _fetch(connection: Any, mapping: TableMapping, *order_by: str) -> list[tuple[Any, ...]]:
        columns = ", ".join(_quote(mapping.columns[name]) for name in mapping.columns)
        ordering = ", ".join(_quote(mapping.columns[name]) for name in order_by)
        # Identifiers were validated against IDENTIFIER_PATTERN while parsing the
        # manifest and are quoted here; no value is interpolated.
        sql = "SELECT {} FROM {} ORDER BY {}".format(  # noqa: S608, UP032
            columns, _quote_relation(mapping.relation), ordering
        )
        try:
            rows = connection.execute(sql).fetchall()
        except Exception as exc:
            raise ManifestError(
                f"lakehouse relation {mapping.relation} cannot be read with the mapped "
                f"columns: {exc}"
            ) from exc
        return [tuple(row) for row in rows]

    @staticmethod
    def _topics(rows: list[tuple[Any, ...]]) -> tuple[Topic, ...]:
        try:
            return tuple(
                Topic(
                    id=str(row[0]),
                    name_en=str(row[1]),
                    name_es=str(row[2]),
                    sort_order=int(row[3]),
                )
                for row in rows
            )
        except (ValidationError, TypeError, ValueError) as exc:
            raise ManifestError(f"lakehouse topics contain invalid rows: {exc}") from exc

    @staticmethod
    def _geographies(rows: list[tuple[Any, ...]]) -> tuple[Geography, ...]:
        try:
            return tuple(
                Geography(
                    iso3=str(row[0]),
                    iso2=str(row[1]),
                    name_en=str(row[2]),
                    name_es=str(row[3]),
                    is_aggregate=bool(row[4]),
                    sort_order=int(row[5]),
                )
                for row in rows
            )
        except (ValidationError, TypeError, ValueError) as exc:
            raise ManifestError(f"lakehouse geographies contain invalid rows: {exc}") from exc

    @staticmethod
    def _indicators(rows: list[tuple[Any, ...]]) -> tuple[Indicator, ...]:
        try:
            return tuple(
                Indicator(
                    code=str(row[0]),
                    topic_id=str(row[1]),
                    name_en=str(row[2]),
                    name_es=str(row[3]),
                    description_en=str(row[4]),
                    description_es=str(row[5]),
                    unit_en=str(row[6]),
                    unit_es=str(row[7]),
                    value_kind=cast(Any, row[8]),
                    decimals=int(row[9]),
                    higher_is=cast(Any, row[10]),
                    source_org_en=str(row[11]),
                    source_org_es=str(row[12]),
                    sort_order=int(row[13]),
                )
                for row in rows
            )
        except (ValidationError, TypeError, ValueError) as exc:
            raise ManifestError(f"lakehouse indicators contain invalid rows: {exc}") from exc

    @staticmethod
    def _observations(rows: list[tuple[Any, ...]]) -> tuple[Observation, ...]:
        try:
            return tuple(
                Observation(
                    indicator_code=str(row[0]),
                    iso3=str(row[1]),
                    year=int(row[2]),
                    value=float(row[3]),
                )
                for row in rows
            )
        except (ValidationError, TypeError, ValueError) as exc:
            raise ManifestError(f"lakehouse observations contain invalid rows: {exc}") from exc

    @staticmethod
    def _check_references(
        topics: tuple[Topic, ...],
        geographies: tuple[Geography, ...],
        indicators: tuple[Indicator, ...],
        observations: tuple[Observation, ...],
    ) -> None:
        topic_ids = {topic.id for topic in topics}
        indicator_codes = {indicator.code for indicator in indicators}
        geography_codes = {geography.iso3 for geography in geographies}
        for indicator in indicators:
            if indicator.topic_id not in topic_ids:
                raise ManifestError(
                    f"lakehouse indicator {indicator.code} references unknown topic "
                    f"{indicator.topic_id}"
                )
        seen: set[tuple[str, str, int]] = set()
        for observation in observations:
            if observation.indicator_code not in indicator_codes:
                raise ManifestError(
                    "lakehouse observation references unknown indicator "
                    f"{observation.indicator_code}"
                )
            if observation.iso3 not in geography_codes:
                raise ManifestError(
                    f"lakehouse observation references unknown geography {observation.iso3}"
                )
            key = (observation.indicator_code, observation.iso3, observation.year)
            if key in seen:
                raise ManifestError(
                    "duplicate lakehouse observation for "
                    f"{observation.indicator_code}/{observation.iso3}/{observation.year}"
                )
            seen.add(key)

    @staticmethod
    def required_columns() -> Mapping[str, tuple[str, ...]]:
        return REQUIRED_COLUMNS
