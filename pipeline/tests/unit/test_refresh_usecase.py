"""Unit tests for the refresh use case with in-memory fakes."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

import pytest

from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.application.refresh import RefreshResult, RefreshUseCase
from ecuador_data.domain.catalog import load_catalog
from ecuador_data.domain.errors import SourceProtocolError
from ecuador_data.domain.models import ObservationPage


class FixedClock:
    def now(self) -> datetime:
        return datetime(2026, 11, 20, 12, 0, tzinfo=UTC)


class FakeSource:
    def __init__(self, *, last_updated: str = "2026-11-11", drop_page: bool = False) -> None:
        self.last_updated = last_updated
        self.drop_page = drop_page
        self.calls: list[tuple[str, str]] = []

    def fetch_indicators(self, codes: list[str], *, language: str) -> list[dict[str, object]]:
        self.calls.append(("indicators", language))
        return [{"id": code, "name": f"{code} {language}", "sourceNote": "note"} for code in codes]

    def fetch_countries(self, iso3s: list[str], *, language: str) -> list[dict[str, object]]:
        self.calls.append(("countries", language))
        return [
            {
                "id": iso3,
                "iso2Code": iso3[:2],
                "name": f"{iso3} {language}",
            }
            for iso3 in iso3s
        ]

    def fetch_observations(
        self, codes: list[str], iso3s: list[str], *, language: str = "en"
    ) -> dict[str, ObservationPage]:
        pages: dict[str, ObservationPage] = {}
        for position, code in enumerate(codes):
            if self.drop_page and position == 0:
                continue
            pages[code] = ObservationPage(
                url=f"https://api.worldbank.org/v2/country/{';'.join(iso3s)}/indicator/{code}",
                retrieved_at="2026-11-20T06:12:38+00:00",
                source_id="2",
                last_updated=self.last_updated,
                rows=(
                    {
                        "indicator": {"id": code},
                        "countryiso3code": "ECU",
                        "date": "2025",
                        "value": 1.0,
                    },
                ),
            )
        return pages


def test_refresh_writes_42_raw_files_and_a_manifest(tmp_path: Path) -> None:
    source = FakeSource()
    store = FileRawStore(tmp_path / "data")
    result = RefreshUseCase(
        source=source, store=store, clock=FixedClock(), catalog=load_catalog()
    ).execute()

    assert isinstance(result, RefreshResult)
    assert result.raw_files == 42
    assert result.source_last_updated == "2026-11-11"
    assert result.retrieved_at == "2026-11-20T06:12:38+00:00"
    assert ("indicators", "en") in source.calls
    assert ("indicators", "es") in source.calls
    assert ("countries", "en") in source.calls
    assert ("countries", "es") in source.calls

    manifest = store.read_manifest()
    assert len(manifest.raw_files) == 42
    assert manifest.dataset.version == "2026-11-20"
    assert manifest.source.license == "CC-BY-4.0"
    assert manifest.snapshot is None
    paths = [record.path for record in manifest.raw_files]
    assert paths == sorted(paths)
    assert "raw/worldbank/observations/NY.GDP.MKTP.CD.json" in paths

    payload = store.read_json("raw/worldbank/observations/NY.GDP.MKTP.CD.json")
    assert payload["meta"]["lastupdated"] == "2026-11-11"
    assert payload["rows"][0]["value"] == 1.0
    store.verify_raw_files(manifest)


def test_refresh_without_last_updated_fails(tmp_path: Path) -> None:
    with pytest.raises(SourceProtocolError, match="lastupdated"):
        RefreshUseCase(
            source=FakeSource(last_updated=""),
            store=FileRawStore(tmp_path / "data"),
            clock=FixedClock(),
            catalog=load_catalog(),
        ).execute()


def test_refresh_with_a_missing_observation_page_fails(tmp_path: Path) -> None:
    with pytest.raises(SourceProtocolError, match="no observation page"):
        RefreshUseCase(
            source=FakeSource(drop_page=True),
            store=FileRawStore(tmp_path / "data"),
            clock=FixedClock(),
            catalog=load_catalog(),
        ).execute()


def test_refresh_falls_back_to_the_clock_for_retrieved_at(tmp_path: Path) -> None:
    class NoRetrievedAt(FakeSource):
        def fetch_observations(
            self, codes: list[str], iso3s: list[str], *, language: str = "en"
        ) -> dict[str, ObservationPage]:
            pages = super().fetch_observations(codes, iso3s, language=language)
            return {
                code: page.model_copy(update={"retrieved_at": ""}) for code, page in pages.items()
            }

    result = RefreshUseCase(
        source=NoRetrievedAt(),
        store=FileRawStore(tmp_path / "data"),
        clock=FixedClock(),
        catalog=load_catalog(),
    ).execute()
    assert result.retrieved_at.startswith("2026-11-20T12:00:00")
