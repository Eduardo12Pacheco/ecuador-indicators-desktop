"""Unit tests for canonical JSON and the logical hash."""

from __future__ import annotations

import random
from pathlib import Path

from hypothesis import given, settings
from hypothesis import strategies as st

from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.domain.integrity import (
    attribution_text,
    canonical_json_bytes,
    dataset_logical_sha256,
    logical_sha256,
    meta_payload,
    pipeline_version,
    sha256_bytes,
    sha256_file,
)
from ecuador_data.domain.models import (
    Dataset,
    Geography,
    Indicator,
    Observation,
    SourceInfo,
    Topic,
)

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "mini_raw"


def _source() -> SourceInfo:
    return SourceInfo(
        dataset_id="ecuador-indicators",
        dataset_version="2026-11-20",
        name="World Development Indicators",
        publisher="The World Bank",
        api="https://api.worldbank.org/v2",
        source_id="2",
        source_last_updated="2026-11-11",
        license="CC-BY-4.0",
        license_url="https://creativecommons.org/licenses/by/4.0/",
        terms_url="https://datacatalog.worldbank.org/public-licenses",
        retrieved_at="2026-11-20T06:12:38+00:00",
    )


def _dataset() -> Dataset:
    topic = Topic(id="economy", name_en="Economy", name_es="Economía", sort_order=1)
    geography = Geography(
        iso3="ECU",
        iso2="EC",
        name_en="Ecuador",
        name_es="Ecuador",
        is_aggregate=False,
        sort_order=1,
    )
    indicator = Indicator(
        code="NY.GDP.MKTP.CD",
        topic_id="economy",
        name_en="GDP",
        name_es="PIB",
        unit_en="current US$",
        unit_es="US$ corrientes",
        value_kind="currency",
        decimals=0,
        higher_is="better",
        sort_order=1,
    )
    return Dataset(
        topics=(topic,),
        geographies=(geography,),
        indicators=(indicator,),
        observations=(
            Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=2024, value=1.5),
            Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=2025, value=2.5),
        ),
        source=_source(),
    )


def test_canonical_json_is_sorted_compact_and_utf8() -> None:
    payload = {"b": 1, "a": "ñ", "c": [2, 1]}
    assert canonical_json_bytes(payload) == b'{"a":"\xc3\xb1","b":1,"c":[2,1]}\n'


def test_sha256_helpers(tmp_path: Path) -> None:
    target = tmp_path / "file.bin"
    target.write_bytes(b"abc")
    assert (
        sha256_bytes(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    )
    assert sha256_file(target) == sha256_bytes(b"abc")


def test_logical_hash_is_stable_for_the_same_content() -> None:
    dataset = _dataset()
    meta = meta_payload(dataset.source)
    first = dataset_logical_sha256(dataset, meta)
    second = dataset_logical_sha256(dataset, meta)
    assert first == second
    assert len(first) == 64


@given(seed=st.integers(min_value=0, max_value=10_000))
@settings(max_examples=25, deadline=None)
def test_logical_hash_is_invariant_to_input_order(seed: int) -> None:
    dataset = _dataset()
    topics = list(dataset.topics)
    geographies = list(dataset.geographies)
    indicators = list(dataset.indicators)
    observations = list(dataset.observations)
    random.Random(seed).shuffle(topics)
    random.Random(seed + 1).shuffle(geographies)
    random.Random(seed + 2).shuffle(indicators)
    random.Random(seed + 3).shuffle(observations)
    meta = meta_payload(dataset.source)
    assert dataset_logical_sha256(dataset, meta) == logical_sha256(
        topics=topics,
        geographies=geographies,
        indicators=indicators,
        observations=observations,
        meta=dict(reversed(list(meta.items()))),
    )


def test_logical_hash_ignores_its_own_key_and_changes_with_values() -> None:
    dataset = _dataset()
    meta = meta_payload(dataset.source)
    base = dataset_logical_sha256(dataset, meta)
    with_hash = dict(meta)
    with_hash["logical_sha256"] = "deadbeef"
    assert dataset_logical_sha256(dataset, with_hash) == base
    changed = dataset.model_copy(
        update={
            "observations": (
                Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=2024, value=9.0),
                Observation(indicator_code="NY.GDP.MKTP.CD", iso3="ECU", year=2025, value=2.5),
            )
        }
    )
    assert dataset_logical_sha256(changed, meta) != base


def test_logical_hash_escapes_control_characters() -> None:
    dataset = _dataset()
    meta = meta_payload(dataset.source)
    base = dataset_logical_sha256(dataset, meta)
    changed = dataset.model_copy(
        update={
            "topics": (Topic(id="economy", name_en="Eco\tnomy", name_es="Economía", sort_order=1),)
        }
    )
    assert dataset_logical_sha256(changed, meta) != base


def test_meta_payload_contains_required_keys_and_attribution() -> None:
    source = _source()
    meta = meta_payload(source)
    assert meta["schema_version"] == "1"
    assert meta["origin"] == "worldbank"
    assert meta["pipeline_version"] == pipeline_version()
    assert "World Bank" in meta["attribution_en"]
    assert "Banco Mundial" in meta["attribution_es"]
    assert meta["retrieved_at"] == source.retrieved_at


def test_meta_payload_allows_a_lakehouse_origin() -> None:
    assert meta_payload(_source(), origin="lakehouse")["origin"] == "lakehouse"


def test_attribution_texts_include_the_retrieval_date() -> None:
    assert "2026-11-20" in attribution_text("en", "2026-11-20T06:12:38+00:00")
    assert "2026-11-20" in attribution_text("es", "2026-11-20T06:12:38+00:00")


def test_fixture_snapshot_recomputes_the_recorded_hash() -> None:
    writer = SqliteSnapshotWriter()
    read = writer.read(FIXTURE / "snapshot" / "ecuador-indicators.snapshot.sqlite")
    assert dataset_logical_sha256(read.dataset, read.meta) == read.meta["logical_sha256"]
