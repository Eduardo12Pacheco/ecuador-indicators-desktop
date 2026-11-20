"""Curated catalog loading and validation.

The catalog is the single curated list of topics, indicators and geographies.
Names, descriptions and source organizations of indicators come from the
World Bank API at refresh time; this module only reads the curated metadata
(topic, value kind, decimals, units and ordering) from TOML.
"""

from __future__ import annotations

import tomllib
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from ecuador_data.domain.errors import CatalogError
from ecuador_data.domain.models import CatalogIndicator, Geography, Topic

CATALOG_DIR_ENV = "ECUADOR_DATA_CATALOG_DIR"


def default_catalog_dir() -> Path:
    """Return the catalog directory shipped next to the pipeline package."""

    return Path(__file__).resolve().parents[3] / "catalog"


class Catalog:
    """Validated curated catalog in file order."""

    __slots__ = ("geographies", "indicators", "topics")

    def __init__(
        self,
        topics: tuple[Topic, ...],
        geographies: tuple[Geography, ...],
        indicators: tuple[CatalogIndicator, ...],
    ) -> None:
        self.topics = topics
        self.geographies = geographies
        self.indicators = indicators

    def indicator_codes(self) -> tuple[str, ...]:
        return tuple(item.code for item in self.indicators)

    def geography_codes(self) -> tuple[str, ...]:
        return tuple(item.iso3 for item in self.geographies)

    def topic_by_id(self, topic_id: str) -> Topic:
        for topic in self.topics:
            if topic.id == topic_id:
                return topic
        raise CatalogError(f"unknown topic: {topic_id}")


def _read_toml(path: Path) -> dict[str, Any]:
    try:
        with path.open("rb") as handle:
            payload = tomllib.load(handle)
    except FileNotFoundError as exc:
        raise CatalogError(f"catalog file not found: {path}") from exc
    except tomllib.TOMLDecodeError as exc:
        raise CatalogError(f"catalog file is not valid TOML: {path}: {exc}") from exc
    return payload


def _table_list(payload: dict[str, Any], key: str, path: Path) -> list[dict[str, Any]]:
    value = payload.get(key)
    if not isinstance(value, list) or not value:
        raise CatalogError(f"catalog file {path} must define at least one [[{key}]] entry")
    tables: list[dict[str, Any]] = []
    for entry in value:
        if not isinstance(entry, dict):
            raise CatalogError(f"catalog file {path}: [[{key}]] entries must be tables")
        tables.append(entry)
    return tables


def _build_topic(entry: dict[str, Any], path: Path) -> Topic:
    try:
        return Topic.model_validate(entry)
    except ValidationError as exc:
        raise CatalogError(f"invalid topic in {path}: {exc}") from exc


def _build_geography(entry: dict[str, Any], path: Path) -> Geography:
    try:
        return Geography.model_validate(entry)
    except ValidationError as exc:
        raise CatalogError(f"invalid geography in {path}: {exc}") from exc


def _build_indicator(entry: dict[str, Any], path: Path) -> CatalogIndicator:
    payload = dict(entry)
    topic = payload.pop("topic", None)
    if not isinstance(topic, str) or not topic:
        raise CatalogError(f"indicator {payload.get('code')!r} in {path} has no topic")
    payload["topic_id"] = topic
    try:
        return CatalogIndicator.model_validate(payload)
    except ValidationError as exc:
        raise CatalogError(f"invalid indicator in {path}: {exc}") from exc


def _ensure_unique(values: list[str], label: str, path: Path) -> None:
    seen: set[str] = set()
    for value in values:
        if value in seen:
            raise CatalogError(f"duplicate {label} {value!r} in {path}")
        seen.add(value)


def load_catalog(catalog_dir: Path | None = None) -> Catalog:
    """Load and validate ``indicators.toml`` and ``geographies.toml``."""

    directory = catalog_dir or default_catalog_dir()
    indicators_path = directory / "indicators.toml"
    geographies_path = directory / "geographies.toml"

    topic_entries = _table_list(_read_toml(indicators_path), "topic", indicators_path)
    indicator_entries = _table_list(_read_toml(indicators_path), "indicator", indicators_path)
    geography_entries = _table_list(_read_toml(geographies_path), "geography", geographies_path)

    return _assemble(
        topic_entries,
        indicator_entries,
        geography_entries,
        indicators_path=indicators_path,
        geographies_path=geographies_path,
    )


def load_catalog_file(path: Path) -> Catalog:
    """Load a single TOML file that defines topics, indicators and geographies.

    The mini subset uses this layout so one file fully describes the fixture.
    """

    payload = _read_toml(path)
    return _assemble(
        _table_list(payload, "topic", path),
        _table_list(payload, "indicator", path),
        _table_list(payload, "geography", path),
        indicators_path=path,
        geographies_path=path,
    )


def load_mini_catalog(catalog_dir: Path | None = None) -> Catalog:
    """Load the six-indicator, five-geography mini subset."""

    directory = catalog_dir or default_catalog_dir()
    return load_catalog_file(directory / "mini.toml")


def _assemble(
    topic_entries: list[dict[str, Any]],
    indicator_entries: list[dict[str, Any]],
    geography_entries: list[dict[str, Any]],
    *,
    indicators_path: Path,
    geographies_path: Path,
) -> Catalog:
    topics = tuple(_build_topic(entry, indicators_path) for entry in topic_entries)
    geographies = tuple(_build_geography(entry, geographies_path) for entry in geography_entries)
    indicators = tuple(_build_indicator(entry, indicators_path) for entry in indicator_entries)

    _ensure_unique([topic.id for topic in topics], "topic id", indicators_path)
    _ensure_unique([geography.iso3 for geography in geographies], "geography", geographies_path)
    _ensure_unique([indicator.code for indicator in indicators], "indicator code", indicators_path)

    known_topics = {topic.id for topic in topics}
    for indicator in indicators:
        if indicator.topic_id not in known_topics:
            raise CatalogError(
                f"indicator {indicator.code} references unknown topic {indicator.topic_id}"
            )

    return Catalog(topics=topics, geographies=geographies, indicators=indicators)
