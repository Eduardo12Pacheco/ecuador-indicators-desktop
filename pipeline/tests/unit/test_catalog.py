"""Unit tests for catalog loading and validation."""

from __future__ import annotations

from pathlib import Path

import pytest

from ecuador_data.domain.catalog import Catalog, default_catalog_dir, load_catalog
from ecuador_data.domain.errors import CatalogError

VALID_INDICATORS = """
[[topic]]
id = "economy"
name_en = "Economy"
name_es = "Economía"
sort_order = 1

[[indicator]]
code = "NY.GDP.MKTP.CD"
topic = "economy"
value_kind = "currency"
decimals = 0
higher_is = "better"
unit_en = "current US$"
unit_es = "US$ corrientes"
sort_order = 1
"""

VALID_GEOGRAPHIES = """
[[geography]]
iso3 = "ECU"
name_en = "Ecuador"
name_es = "Ecuador"
iso2 = "EC"
is_aggregate = false
sort_order = 1
"""


def _write(
    directory: Path, indicators: str = VALID_INDICATORS, geographies: str = VALID_GEOGRAPHIES
) -> None:
    (directory / "indicators.toml").write_text(indicators, encoding="utf-8")
    (directory / "geographies.toml").write_text(geographies, encoding="utf-8")


def test_default_catalog_has_38_indicators_8_topics_and_7_geographies() -> None:
    catalog = load_catalog()
    assert isinstance(catalog, Catalog)
    assert len(catalog.indicators) == 38
    assert len(catalog.topics) == 8
    assert len(catalog.geographies) == 7
    assert catalog.indicator_codes()[0] == "NY.GDP.MKTP.CD"
    assert catalog.indicator_codes()[-1] == "IT.CEL.SETS.P2"
    assert catalog.geography_codes() == ("ECU", "COL", "PER", "CHL", "BOL", "LCN", "WLD")
    assert catalog.topics[0].name_es == "Economía y precios"
    assert catalog.geographies[-1].is_aggregate is True


def test_default_catalog_dir_points_to_the_repository_catalog() -> None:
    assert default_catalog_dir().joinpath("indicators.toml").is_file()


def test_topic_lookup() -> None:
    catalog = load_catalog()
    assert catalog.topic_by_id("labour").name_en == "Labour & poverty"
    with pytest.raises(CatalogError, match="unknown topic"):
        catalog.topic_by_id("missing")


def test_loads_a_minimal_valid_catalog(tmp_path: Path) -> None:
    _write(tmp_path)
    catalog = load_catalog(tmp_path)
    assert len(catalog.indicators) == 1
    assert catalog.indicators[0].topic_id == "economy"


def test_missing_catalog_file(tmp_path: Path) -> None:
    with pytest.raises(CatalogError, match="catalog file not found"):
        load_catalog(tmp_path)


def test_malformed_toml(tmp_path: Path) -> None:
    _write(tmp_path, indicators="[[topic]\nbroken")
    with pytest.raises(CatalogError, match="not valid TOML"):
        load_catalog(tmp_path)


def test_missing_topic_entries(tmp_path: Path) -> None:
    _write(tmp_path, indicators="")
    with pytest.raises(CatalogError, match="at least one"):
        load_catalog(tmp_path)


def test_missing_geography_entries(tmp_path: Path) -> None:
    _write(tmp_path, geographies="")
    with pytest.raises(CatalogError, match="at least one"):
        load_catalog(tmp_path)


def test_non_table_entry(tmp_path: Path) -> None:
    _write(
        tmp_path,
        indicators=VALID_INDICATORS.replace('id = "economy"', "id = 1", 1),
    )
    with pytest.raises(CatalogError, match="invalid topic"):
        load_catalog(tmp_path)


def test_duplicate_indicator_code(tmp_path: Path) -> None:
    duplicate = VALID_INDICATORS + VALID_INDICATORS.split("\n\n", 1)[1]
    _write(tmp_path, indicators=duplicate)
    with pytest.raises(CatalogError, match="duplicate indicator code"):
        load_catalog(tmp_path)


def test_unknown_topic_reference(tmp_path: Path) -> None:
    _write(
        tmp_path,
        indicators=VALID_INDICATORS.replace('topic = "economy"', 'topic = "unknown"'),
    )
    with pytest.raises(CatalogError, match="unknown topic unknown"):
        load_catalog(tmp_path)


def test_indicator_without_topic(tmp_path: Path) -> None:
    _write(tmp_path, indicators=VALID_INDICATORS.replace('topic = "economy"\n', ""))
    with pytest.raises(CatalogError, match="has no topic"):
        load_catalog(tmp_path)


def test_invalid_indicator_kind(tmp_path: Path) -> None:
    _write(
        tmp_path,
        indicators=VALID_INDICATORS.replace('value_kind = "currency"', 'value_kind = "money"'),
    )
    with pytest.raises(CatalogError, match="invalid indicator"):
        load_catalog(tmp_path)


def test_invalid_geography_iso3(tmp_path: Path) -> None:
    _write(tmp_path, geographies=VALID_GEOGRAPHIES.replace('iso3 = "ECU"', 'iso3 = "ecu"'))
    with pytest.raises(CatalogError, match="invalid geography"):
        load_catalog(tmp_path)


def test_duplicate_geography(tmp_path: Path) -> None:
    _write(tmp_path, geographies=VALID_GEOGRAPHIES + VALID_GEOGRAPHIES)
    with pytest.raises(CatalogError, match="duplicate geography"):
        load_catalog(tmp_path)
