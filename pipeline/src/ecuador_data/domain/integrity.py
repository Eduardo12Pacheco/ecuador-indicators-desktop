"""Canonical serialization and integrity hashes."""

from __future__ import annotations

import hashlib
import json
from collections.abc import Iterable, Mapping, Sequence
from pathlib import Path

from ecuador_data import __version__
from ecuador_data.domain.models import (
    Dataset,
    Geography,
    Indicator,
    Observation,
    SourceInfo,
    Topic,
)

TOPIC_COLUMNS = ("id", "name_en", "name_es", "sort_order")
GEOGRAPHY_COLUMNS = ("iso3", "iso2", "name_en", "name_es", "is_aggregate", "sort_order")
INDICATOR_COLUMNS = (
    "code",
    "topic_id",
    "name_en",
    "name_es",
    "description_en",
    "description_es",
    "unit_en",
    "unit_es",
    "value_kind",
    "decimals",
    "higher_is",
    "source_org_en",
    "source_org_es",
    "sort_order",
)
OBSERVATION_COLUMNS = ("indicator_code", "iso3", "year", "value")
META_COLUMNS = ("key", "value")
LOGICAL_HASH_KEY = "logical_sha256"


def canonical_json_bytes(payload: object) -> bytes:
    """Serialize *payload* as canonical JSON with a trailing newline."""

    text = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return (text + "\n").encode("utf-8")


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _escape_string(value: str) -> str:
    return value.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n")


def _format_value(value: object) -> str:
    if value is None:
        return "\\N"
    if isinstance(value, bool):
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    return _escape_string(str(value))


def _format_row(table: str, values: Sequence[object]) -> str:
    cells = "\t".join(_format_value(value) for value in values)
    return f"{table}\t{cells}\n"


def _rows_from_topics(topics: Iterable[Topic]) -> list[tuple[object, ...]]:
    return [
        tuple(getattr(topic, column) for column in TOPIC_COLUMNS)
        for topic in sorted(topics, key=lambda item: item.id)
    ]


def _rows_from_geographies(geographies: Iterable[Geography]) -> list[tuple[object, ...]]:
    return [
        tuple(getattr(geography, column) for column in GEOGRAPHY_COLUMNS)
        for geography in sorted(geographies, key=lambda item: item.iso3)
    ]


def _rows_from_indicators(indicators: Iterable[Indicator]) -> list[tuple[object, ...]]:
    return [
        tuple(getattr(indicator, column) for column in INDICATOR_COLUMNS)
        for indicator in sorted(indicators, key=lambda item: item.code)
    ]


def _rows_from_observations(observations: Iterable[Observation]) -> list[tuple[object, ...]]:
    return [
        tuple(getattr(observation, column) for column in OBSERVATION_COLUMNS)
        for observation in sorted(
            observations, key=lambda item: (item.indicator_code, item.iso3, item.year)
        )
    ]


def _rows_from_meta(meta: Mapping[str, str]) -> list[tuple[object, ...]]:
    return [(key, meta[key]) for key in sorted(meta) if key != LOGICAL_HASH_KEY]


def logical_sha256(
    *,
    topics: Iterable[Topic],
    geographies: Iterable[Geography],
    indicators: Iterable[Indicator],
    observations: Iterable[Observation],
    meta: Mapping[str, str],
) -> str:
    """Hash the logical content of a dataset.

    The text format is defined by the plan: tables in the order topic,
    geography, indicator, observation, meta; rows ordered by primary key; one
    tab-separated line per row prefixed with the table name.
    """

    digest = hashlib.sha256()
    tables: tuple[tuple[str, list[tuple[object, ...]]], ...] = (
        ("topic", _rows_from_topics(topics)),
        ("geography", _rows_from_geographies(geographies)),
        ("indicator", _rows_from_indicators(indicators)),
        ("observation", _rows_from_observations(observations)),
        ("meta", _rows_from_meta(meta)),
    )
    for table, rows in tables:
        for row in rows:
            digest.update(_format_row(table, row).encode("utf-8"))
    return digest.hexdigest()


def dataset_logical_sha256(dataset: Dataset, meta: Mapping[str, str]) -> str:
    return logical_sha256(
        topics=dataset.topics,
        geographies=dataset.geographies,
        indicators=dataset.indicators,
        observations=dataset.observations,
        meta=meta,
    )


def meta_payload(source: SourceInfo, *, origin: str = "worldbank") -> dict[str, str]:
    """Build the snapshot ``meta`` mapping from a :class:`SourceInfo`."""

    return {
        "schema_version": "1",
        "dataset_id": source.dataset_id,
        "dataset_version": source.dataset_version,
        "origin": origin,
        "source_name": source.name,
        "source_publisher": source.publisher,
        "source_last_updated": source.source_last_updated,
        "retrieved_at": source.retrieved_at,
        "license": source.license,
        "license_url": source.license_url,
        "attribution_en": attribution_text("en", source.retrieved_at),
        "attribution_es": attribution_text("es", source.retrieved_at),
        "pipeline_version": pipeline_version(),
    }


def pipeline_version() -> str:
    return __version__


def attribution_text(language: str, retrieved_at: str) -> str:
    date = retrieved_at[:10]
    if language == "es":
        return (
            f"Fuente: Banco Mundial, Indicadores del Desarrollo Mundial (WDI), "
            f"licencia CC BY 4.0. Obtenido el {date} mediante la API de Indicadores "
            "del Banco Mundial v2. Los proveedores subyacentes de datos se acreditan "
            "por indicador. Los nombres y notas en español son provistos por el Banco "
            f"Mundial; los valores derivados (variación año a año, índice, CAGR) son "
            "calculados por esta aplicación."
        )
    return (
        f"Source: The World Bank, World Development Indicators (WDI), licensed under "
        f"CC BY 4.0. Retrieved {date} through the World Bank Indicators API v2. "
        "Underlying data providers are credited per indicator. Spanish names and notes "
        "are provided by the World Bank; derived values (year-over-year change, index, "
        "CAGR) are computed by this application."
    )
