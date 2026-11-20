"""Frozen domain models shared by the pipeline layers."""

from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

ValueKind = Literal["currency", "percent", "number", "years", "rate", "index"]
HigherIs = Literal["better", "worse", "neutral"]
Origin = Literal["worldbank", "lakehouse"]
Language = Literal["en", "es"]


class FrozenModel(BaseModel):
    """Base model: immutable and strict about unknown fields."""

    model_config = ConfigDict(frozen=True, extra="forbid")


class Topic(FrozenModel):
    id: str = Field(min_length=1)
    name_en: str = Field(min_length=1)
    name_es: str = Field(min_length=1)
    sort_order: int = Field(ge=0)


class Geography(FrozenModel):
    iso3: str = Field(pattern=r"^[A-Z]{3}$")
    iso2: str = Field(min_length=2, max_length=3)
    name_en: str = Field(min_length=1)
    name_es: str = Field(min_length=1)
    is_aggregate: bool
    sort_order: int = Field(ge=0)


class Indicator(FrozenModel):
    code: str = Field(min_length=1)
    topic_id: str = Field(min_length=1)
    name_en: str = Field(min_length=1)
    name_es: str = Field(min_length=1)
    description_en: str = ""
    description_es: str = ""
    unit_en: str = Field(min_length=1)
    unit_es: str = Field(min_length=1)
    value_kind: ValueKind
    decimals: int = Field(ge=0, le=4)
    higher_is: HigherIs
    source_org_en: str = ""
    source_org_es: str = ""
    sort_order: int = Field(ge=0)


class CatalogIndicator(FrozenModel):
    """Curated indicator metadata; names and descriptions come from the API."""

    code: str = Field(min_length=1)
    topic_id: str = Field(min_length=1)
    unit_en: str = Field(min_length=1)
    unit_es: str = Field(min_length=1)
    value_kind: ValueKind
    decimals: int = Field(ge=0, le=4)
    higher_is: HigherIs
    sort_order: int = Field(ge=0)
    # The World Bank Spanish API returns an empty entry for a few indicators.
    # These curated fallbacks are used only when the API value is empty, so the
    # snapshot still satisfies the bilingual contract (S2).
    fallback_name_es: str | None = None
    fallback_description_es: str | None = None
    fallback_source_org_es: str | None = None


class Observation(FrozenModel):
    indicator_code: str = Field(min_length=1)
    iso3: str = Field(pattern=r"^[A-Z]{3}$")
    year: int = Field(ge=1900, le=2100)
    value: float

    @field_validator("value")
    @classmethod
    def value_must_be_finite(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("observation value must be finite")
        return value


class SourceInfo(FrozenModel):
    dataset_id: str = Field(min_length=1)
    dataset_version: str = Field(min_length=1)
    name: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    api: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    source_last_updated: str = Field(min_length=1)
    license: str = Field(min_length=1)
    license_url: str = Field(min_length=1)
    terms_url: str = Field(min_length=1)
    retrieved_at: str = Field(min_length=1)


class Counts(FrozenModel):
    topics: int = Field(ge=0)
    geographies: int = Field(ge=0)
    indicators: int = Field(ge=0)
    observations: int = Field(ge=0)


class Dataset(FrozenModel):
    topics: tuple[Topic, ...]
    geographies: tuple[Geography, ...]
    indicators: tuple[Indicator, ...]
    observations: tuple[Observation, ...]
    source: SourceInfo

    def counts(self) -> Counts:
        return Counts(
            topics=len(self.topics),
            geographies=len(self.geographies),
            indicators=len(self.indicators),
            observations=len(self.observations),
        )


class RawFileRecord(FrozenModel):
    path: str = Field(min_length=1)
    url: str = Field(min_length=1)
    bytes: int = Field(ge=0)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")


class DatasetMeta(FrozenModel):
    id: str = Field(min_length=1)
    version: str = Field(min_length=1)
    title: str = Field(min_length=1)


class SourceMeta(FrozenModel):
    name: str = Field(min_length=1)
    publisher: str = Field(min_length=1)
    api: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    source_last_updated: str = Field(min_length=1)
    license: str = Field(min_length=1)
    license_url: str = Field(min_length=1)
    terms_url: str = Field(min_length=1)


class SnapshotMeta(FrozenModel):
    path: str = Field(min_length=1)
    schema_version: int = Field(ge=1)
    sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    logical_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    counts: Counts


class RawManifest(FrozenModel):
    manifest_version: Literal[1] = 1
    dataset: DatasetMeta
    source: SourceMeta
    retrieved_at: str = Field(min_length=1)
    raw_files: tuple[RawFileRecord, ...] = ()
    snapshot: SnapshotMeta | None = None


class ObservationPage(FrozenModel):
    """One paginated World Bank observation response."""

    url: str = Field(min_length=1)
    retrieved_at: str = Field(min_length=1)
    source_id: str = ""
    last_updated: str = ""
    rows: tuple[dict[str, object], ...] = ()


class SnapshotRead(FrozenModel):
    dataset: Dataset
    meta: dict[str, str]


class BuildResult(FrozenModel):
    path: str
    logical_sha256: str
    counts: Counts


class VerifyResult(FrozenModel):
    counts: Counts
    logical_sha256: str
    snapshot_sha256: str
