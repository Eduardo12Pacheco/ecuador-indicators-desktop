"""Unit tests for the frozen domain models."""

from __future__ import annotations

import math

import pytest
from pydantic import ValidationError

from ecuador_data.domain.models import (
    Counts,
    Dataset,
    Geography,
    Observation,
    SourceInfo,
    Topic,
)


def test_topic_round_trip() -> None:
    topic = Topic(id="economy", name_en="Economy", name_es="Economía", sort_order=1)
    assert topic.model_dump()["id"] == "economy"
    with pytest.raises(ValidationError):
        topic.id = "other"  # type: ignore[misc]


def test_geography_rejects_lowercase_iso3() -> None:
    with pytest.raises(ValidationError):
        Geography(
            iso3="ecu",
            iso2="EC",
            name_en="Ecuador",
            name_es="Ecuador",
            is_aggregate=False,
            sort_order=1,
        )


def test_observation_accepts_finite_value() -> None:
    observation = Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=2025, value=1.5)
    assert observation.value == 1.5


@pytest.mark.parametrize("value", [math.nan, math.inf, -math.inf])
def test_observation_rejects_non_finite_value(value: float) -> None:
    with pytest.raises(ValidationError):
        Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=2025, value=value)


@pytest.mark.parametrize("year", [1899, 2101])
def test_observation_rejects_out_of_range_year(year: int) -> None:
    with pytest.raises(ValidationError):
        Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=year, value=1.0)


def test_dataset_counts() -> None:
    source = SourceInfo(
        dataset_id="ecuador-indicators",
        dataset_version="2026-11-20",
        name="WDI",
        publisher="World Bank",
        api="https://api.worldbank.org/v2",
        source_id="2",
        source_last_updated="2026-11-11",
        license="CC-BY-4.0",
        license_url="https://creativecommons.org/licenses/by/4.0/",
        terms_url="https://datacatalog.worldbank.org/public-licenses",
        retrieved_at="2026-11-20T00:00:00+00:00",
    )
    dataset = Dataset(
        topics=(Topic(id="economy", name_en="Economy", name_es="Economía", sort_order=1),),
        geographies=(
            Geography(
                iso3="ECU",
                iso2="EC",
                name_en="Ecuador",
                name_es="Ecuador",
                is_aggregate=False,
                sort_order=1,
            ),
        ),
        indicators=(),
        observations=(),
        source=source,
    )
    assert dataset.counts() == Counts(topics=1, geographies=1, indicators=0, observations=0)


def test_models_forbid_unknown_fields() -> None:
    with pytest.raises(ValidationError):
        Topic.model_validate(
            {"id": "economy", "name_en": "Economy", "name_es": "Economía", "sort_order": 1, "x": 2}
        )
