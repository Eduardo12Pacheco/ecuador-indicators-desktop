"""Lakehouse manifest v1 contract.

A sibling lakehouse produces a DuckDB file plus a JSON manifest that maps its
relations and columns to the schema-v1 snapshot tables. The manifest is parsed
here, in the pure domain layer; reading files and opening DuckDB belongs to the
adapter.

The contract is documented in ``docs/LAKEHOUSE-MANIFEST.md`` and encoded in
``pipeline/schemas/lakehouse-manifest.v1.schema.json`` (JSON Schema draft
2020-12). It is a proposed contract: no sibling artifact existed when it was
written (ADR 0009).
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Literal

from pydantic import Field, ValidationError, field_validator, model_validator

from ecuador_data.domain.errors import ManifestError
from ecuador_data.domain.models import Dataset, FrozenModel

MANIFEST_KIND = "ecuador-indicators-lakehouse-export"
MANIFEST_VERSION_MAJOR = 1

IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$")
SHA256_PATTERN = r"^[0-9a-f]{64}$"

REQUIRED_COLUMNS: dict[str, tuple[str, ...]] = {
    "topics": ("id", "name_en", "name_es", "sort_order"),
    "geographies": ("iso3", "iso2", "name_en", "name_es", "is_aggregate", "sort_order"),
    "indicators": (
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
    ),
    "observations": ("indicator_code", "iso3", "year", "value"),
}


class LakehouseDataset(FrozenModel):
    id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    title: str = Field(min_length=1)


class LakehouseLicense(FrozenModel):
    spdx: str = Field(min_length=1)
    url: str = Field(min_length=1)
    attribution_en: str = Field(min_length=1)
    attribution_es: str = Field(min_length=1)


class LakehouseDuckDb(FrozenModel):
    path: str = Field(min_length=1)
    sha256: str = Field(pattern=SHA256_PATTERN)


class TableMapping(FrozenModel):
    relation: str = Field(pattern=IDENTIFIER_PATTERN.pattern)
    columns: dict[str, str]


class LakehouseRelations(FrozenModel):
    topics: TableMapping
    geographies: TableMapping
    indicators: TableMapping
    observations: TableMapping


class LakehouseManifest(FrozenModel):
    manifest_version: str = Field(min_length=1)
    kind: Literal["ecuador-indicators-lakehouse-export"]
    generated_at: str = Field(min_length=1)
    dataset: LakehouseDataset
    license: LakehouseLicense
    duckdb: LakehouseDuckDb
    relations: LakehouseRelations

    @field_validator("manifest_version")
    @classmethod
    def version_major_must_be_one(cls, value: str) -> str:
        major = value.split(".", 1)[0]
        if value.count(".") != 1 or not all(part.isdigit() for part in value.split(".")):
            raise ValueError(
                f"manifest_version must have the form '{MANIFEST_VERSION_MAJOR}.<minor>'"
            )
        if int(major) != MANIFEST_VERSION_MAJOR:
            raise ValueError(
                f"manifest_version major must be {MANIFEST_VERSION_MAJOR}, got {value!r}"
            )
        return value

    @field_validator("generated_at")
    @classmethod
    def generated_at_must_be_iso8601_utc(cls, value: str) -> str:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError("generated_at must be an ISO-8601 timestamp") from exc
        if parsed.tzinfo is None:
            raise ValueError("generated_at must carry a UTC offset")
        return value

    @model_validator(mode="after")
    def column_mappings_must_match_the_contract(self) -> LakehouseManifest:
        for table, required in REQUIRED_COLUMNS.items():
            mapping = getattr(self.relations, table)
            missing = set(required) - set(mapping.columns)
            if missing:
                raise ValueError(
                    f"missing column mapping for {table}: {', '.join(sorted(missing))}"
                )
            unknown = set(mapping.columns) - set(required)
            if unknown:
                raise ValueError(
                    f"unknown column mapping for {table}: {', '.join(sorted(unknown))}"
                )
            for column, physical in mapping.columns.items():
                if not IDENTIFIER_PATTERN.fullmatch(physical):
                    raise ValueError(f"unsafe column identifier for {table}.{column}: {physical!r}")
        return self


class LakehouseImport(FrozenModel):
    """A dataset read from DuckDB together with the manifest that described it."""

    dataset: Dataset
    manifest: LakehouseManifest


def parse_manifest(payload: object) -> LakehouseManifest:
    """Validate a decoded manifest, mapping pydantic errors to ``ManifestError``."""

    try:
        return LakehouseManifest.model_validate(payload)
    except ValidationError as exc:
        raise ManifestError(f"invalid lakehouse manifest: {exc}") from exc
