"""Unit tests for the lakehouse manifest v1 contract."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

import pytest

from ecuador_data.domain.errors import ManifestError
from ecuador_data.domain.manifest import (
    IDENTIFIER_PATTERN,
    REQUIRED_COLUMNS,
    parse_manifest,
)

SHA = "a" * 64
SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "lakehouse-manifest.v1.schema.json"


def _manifest(version: str = "1.0") -> dict[str, Any]:
    return {
        "manifest_version": version,
        "kind": "ecuador-indicators-lakehouse-export",
        "generated_at": "2026-11-20T06:00:00+00:00",
        "dataset": {
            "id": "sibling-lakehouse",
            "version": "2026.11",
            "title": "Sibling lakehouse export",
        },
        "license": {
            "spdx": "CC-BY-4.0",
            "url": "https://creativecommons.org/licenses/by/4.0/",
            "attribution_en": "Source: sibling lakehouse.",
            "attribution_es": "Fuente: lakehouse hermano.",
        },
        "duckdb": {"path": "export.duckdb", "sha256": SHA},
        "relations": {
            "topics": {
                "relation": "lakehouse.topic",
                "columns": {column: column for column in REQUIRED_COLUMNS["topics"]},
            },
            "geographies": {
                "relation": "lakehouse.geography",
                "columns": {column: column for column in REQUIRED_COLUMNS["geographies"]},
            },
            "indicators": {
                "relation": "lakehouse.indicator",
                "columns": {column: column for column in REQUIRED_COLUMNS["indicators"]},
            },
            "observations": {
                "relation": "lakehouse.observation",
                "columns": {column: column for column in REQUIRED_COLUMNS["observations"]},
            },
        },
    }


def test_parses_a_valid_manifest() -> None:
    manifest = parse_manifest(_manifest())
    assert manifest.manifest_version == "1.0"
    assert manifest.kind == "ecuador-indicators-lakehouse-export"
    assert manifest.dataset.id == "sibling-lakehouse"
    assert manifest.relations.observations.relation == "lakehouse.observation"
    assert manifest.relations.indicators.columns["sort_order"] == "sort_order"


@pytest.mark.parametrize("version", ["1.0", "1.4", "1.99"])
def test_accepts_any_minor_version_of_major_one(version: str) -> None:
    assert parse_manifest(_manifest(version)).manifest_version == version


@pytest.mark.parametrize("version", ["2.0", "0.9", "1", "one.0", ""])
def test_rejects_other_major_versions(version: str) -> None:
    with pytest.raises(ManifestError, match="manifest_version"):
        parse_manifest(_manifest(version))


def test_rejects_an_unknown_kind() -> None:
    payload = _manifest()
    payload["kind"] = "another-export"
    with pytest.raises(ManifestError, match="kind"):
        parse_manifest(payload)


def test_rejects_unknown_top_level_fields() -> None:
    payload = _manifest()
    payload["extra"] = True
    with pytest.raises(ManifestError, match="extra"):
        parse_manifest(payload)


@pytest.mark.parametrize("relation", ["lakehouse; DROP TABLE x", "lakehouse.", "1table", ""])
def test_rejects_an_unsafe_relation_identifier(relation: str) -> None:
    payload = _manifest()
    payload["relations"]["observations"]["relation"] = relation
    with pytest.raises(ManifestError, match="relation|String should match pattern"):
        parse_manifest(payload)


@pytest.mark.parametrize("column", ["year desc", "value--", "1value", "value;DROP"])
def test_rejects_an_unsafe_column_identifier(column: str) -> None:
    payload = _manifest()
    payload["relations"]["observations"]["columns"]["year"] = column
    with pytest.raises(ManifestError, match="column"):
        parse_manifest(payload)


@pytest.mark.parametrize(
    ("table", "column"),
    [
        ("topics", "name_es"),
        ("geographies", "is_aggregate"),
        ("indicators", "source_org_es"),
        ("observations", "year"),
    ],
)
def test_rejects_a_missing_column_mapping(table: str, column: str) -> None:
    payload = _manifest()
    del payload["relations"][table]["columns"][column]
    with pytest.raises(ManifestError, match=f"missing column mapping|{column}"):
        parse_manifest(payload)


def test_rejects_an_extra_column_mapping() -> None:
    payload = _manifest()
    payload["relations"]["topics"]["columns"]["unknown"] = "unknown"
    with pytest.raises(ManifestError, match="unknown column mapping"):
        parse_manifest(payload)


@pytest.mark.parametrize("sha", ["A" * 64, "a" * 63, "z" * 64, ""])
def test_rejects_an_invalid_duckdb_sha256(sha: str) -> None:
    payload = _manifest()
    payload["duckdb"]["sha256"] = sha
    with pytest.raises(ManifestError, match="sha256"):
        parse_manifest(payload)


def test_rejects_a_non_object_payload() -> None:
    with pytest.raises(ManifestError, match="manifest"):
        parse_manifest(["not", "an", "object"])


def test_identifier_pattern_matches_the_documented_contract() -> None:
    assert IDENTIFIER_PATTERN.fullmatch("topic")
    assert IDENTIFIER_PATTERN.fullmatch("lakehouse.topic")
    assert IDENTIFIER_PATTERN.fullmatch("_private.Table_2")
    assert IDENTIFIER_PATTERN.fullmatch("a.b.c") is None
    assert IDENTIFIER_PATTERN.fullmatch("lakehouse topic") is None


def test_json_schema_matches_the_domain_contract() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert set(schema["required"]) == {
        "manifest_version",
        "kind",
        "generated_at",
        "dataset",
        "license",
        "duckdb",
        "relations",
    }
    assert schema["properties"]["kind"]["const"] == "ecuador-indicators-lakehouse-export"
    definitions = schema["$defs"]
    for table, columns in REQUIRED_COLUMNS.items():
        columns_schema = definitions[f"{table}Columns"]
        assert set(columns_schema["required"]) == set(columns)
        assert columns_schema["additionalProperties"] is False
        assert set(columns_schema["properties"]) == set(columns)
    relations = schema["properties"]["relations"]
    assert set(relations["required"]) == set(REQUIRED_COLUMNS)


def test_manifest_dict_is_not_mutated_by_parsing() -> None:
    payload = _manifest()
    before = copy.deepcopy(payload)
    parse_manifest(payload)
    assert payload == before
