"""Integration tests for the World Bank API adapter using recorded fixtures."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from ecuador_data.adapters.worldbank_api import API_ROOT, WorldBankApiSource
from ecuador_data.domain.errors import SourceProtocolError, SourceUnavailableError

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "worldbank"
OBSERVATION_URL = f"{API_ROOT}/country/ECU;COL;LCN/indicator/NY.GDP.MKTP.CD"
INDICATOR_URL = f"{API_ROOT}/indicator/NY.GDP.MKTP.CD"
SPANISH_INDICATOR_URL = f"{API_ROOT}/es/indicator/NY.GDP.MKTP.CD"
COUNTRIES_URL = f"{API_ROOT}/country/ECU;COL;LCN"


class FixedClock:
    def now(self) -> datetime:
        return datetime(2026, 11, 20, 6, 12, 38, tzinfo=UTC)


def _fixture(name: str) -> Any:
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def _source(**kwargs: Any) -> WorldBankApiSource:
    return WorldBankApiSource(clock=FixedClock(), client=httpx.Client(), **kwargs)


@respx.mock
def test_fetch_observations_paginates_and_skips_null_values() -> None:
    payload = _fixture("observations_NY.GDP.MKTP.CD.json")
    meta, rows = payload[0], payload[1]
    with_null = dict(rows[0])
    with_null["value"] = None
    page_one = [dict(meta, page=1, pages=2, per_page=2, total=len(rows)), [with_null, rows[0]]]
    page_two = [dict(meta, page=2, pages=2, per_page=2, total=len(rows)), rows[1:]]
    route = respx.get(url__startswith=OBSERVATION_URL).mock(
        side_effect=[
            httpx.Response(200, json=page_one),
            httpx.Response(200, json=page_two),
        ]
    )
    source = _source()
    try:
        pages = source.fetch_observations(["NY.GDP.MKTP.CD"], ["ECU", "COL", "LCN"])
    finally:
        source.close()
    assert route.call_count == 2
    page = pages["NY.GDP.MKTP.CD"]
    assert len(page.rows) == len(rows)
    assert all(row["value"] is not None for row in page.rows)
    assert page.source_id == "2"
    assert page.last_updated == "2026-11-11"
    assert page.retrieved_at.startswith("2026-11-20T06:12:38")
    keys = [(row["countryiso3code"], row["date"]) for row in page.rows]
    assert keys == sorted(keys)


@respx.mock
def test_retry_then_success(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr("ecuador_data.adapters.worldbank_api.time.sleep", sleeps.append)
    payload = _fixture("observations_NY.GDP.MKTP.CD.json")
    route = respx.get(OBSERVATION_URL).mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(200, json=payload),
        ]
    )
    source = _source()
    try:
        pages = source.fetch_observations(["NY.GDP.MKTP.CD"], ["ECU", "COL", "LCN"])
    finally:
        source.close()
    assert route.call_count == 2
    assert sleeps == [0.5]
    assert pages["NY.GDP.MKTP.CD"].rows


@respx.mock
def test_retry_after_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("ecuador_data.adapters.worldbank_api.time.sleep", lambda _: None)
    payload = _fixture("indicator_NY.GDP.MKTP.CD.en.json")
    route = respx.get(INDICATOR_URL).mock(
        side_effect=[httpx.TimeoutException("timed out"), httpx.Response(200, json=payload)]
    )
    source = _source()
    try:
        indicators = source.fetch_indicators(["NY.GDP.MKTP.CD"], language="en")
    finally:
        source.close()
    assert route.call_count == 2
    assert indicators[0]["id"] == "NY.GDP.MKTP.CD"


@respx.mock
def test_429_exhaustion_raises_source_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    sleeps: list[float] = []
    monkeypatch.setattr("ecuador_data.adapters.worldbank_api.time.sleep", sleeps.append)
    route = respx.get(INDICATOR_URL).mock(return_value=httpx.Response(429))
    source = _source(retries=4)
    try:
        with pytest.raises(SourceUnavailableError, match="after 4 attempts"):
            source.fetch_indicators(["NY.GDP.MKTP.CD"], language="en")
    finally:
        source.close()
    assert route.call_count == 4
    assert sleeps == [0.5, 1.0, 2.0]


@respx.mock
def test_transport_error_exhaustion(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("ecuador_data.adapters.worldbank_api.time.sleep", lambda _: None)
    respx.get(INDICATOR_URL).mock(side_effect=httpx.ConnectError("no route"))
    source = _source(retries=2)
    try:
        with pytest.raises(SourceUnavailableError, match="transport error"):
            source.fetch_indicators(["NY.GDP.MKTP.CD"], language="en")
    finally:
        source.close()


@respx.mock
def test_error_envelope_raises_source_protocol_error() -> None:
    envelope = _fixture("error_envelope.json")
    respx.get(INDICATOR_URL).mock(return_value=httpx.Response(200, json=envelope))
    source = _source()
    try:
        with pytest.raises(SourceProtocolError, match="error envelope"):
            source.fetch_indicators(["NY.GDP.MKTP.CD"], language="en")
    finally:
        source.close()


@respx.mock
def test_invalid_json_raises_source_protocol_error() -> None:
    respx.get(INDICATOR_URL).mock(return_value=httpx.Response(200, text="not json"))
    source = _source()
    try:
        with pytest.raises(SourceProtocolError, match="invalid JSON"):
            source.fetch_indicators(["NY.GDP.MKTP.CD"], language="en")
    finally:
        source.close()


@respx.mock
def test_non_retryable_http_error_raises_source_unavailable() -> None:
    route = respx.get(INDICATOR_URL).mock(return_value=httpx.Response(404))
    source = _source()
    try:
        with pytest.raises(SourceUnavailableError, match="HTTP 404"):
            source.fetch_indicators(["NY.GDP.MKTP.CD"], language="en")
    finally:
        source.close()
    assert route.call_count == 1


@respx.mock
def test_unexpected_payload_shape() -> None:
    respx.get(INDICATOR_URL).mock(return_value=httpx.Response(200, json={"oops": True}))
    source = _source()
    try:
        with pytest.raises(SourceProtocolError, match="unexpected"):
            source.fetch_indicators(["NY.GDP.MKTP.CD"], language="en")
    finally:
        source.close()


@respx.mock
def test_fetch_spanish_indicator_names() -> None:
    payload = _fixture("indicator_NY.GDP.MKTP.CD.es.json")
    respx.get(SPANISH_INDICATOR_URL).mock(return_value=httpx.Response(200, json=payload))
    source = _source()
    try:
        indicators = source.fetch_indicators(["NY.GDP.MKTP.CD"], language="es")
    finally:
        source.close()
    assert indicators[0]["name"] == "PIB (US$ a precios actuales)"


@respx.mock
def test_fetch_countries_returns_all_requested_geographies() -> None:
    payload = _fixture("countries.en.json")
    respx.get(COUNTRIES_URL).mock(return_value=httpx.Response(200, json=payload))
    source = _source()
    try:
        countries = source.fetch_countries(["ECU", "COL", "LCN"], language="en")
    finally:
        source.close()
    assert {country["id"] for country in countries} == {"ECU", "COL", "LCN"}


@respx.mock
def test_fetch_countries_reports_missing_geographies() -> None:
    payload = _fixture("countries.en.json")
    respx.get(f"{API_ROOT}/country/ECU;PER").mock(return_value=httpx.Response(200, json=payload))
    source = _source()
    try:
        with pytest.raises(SourceProtocolError, match="PER"):
            source.fetch_countries(["ECU", "PER"], language="en")
    finally:
        source.close()


def test_rejects_invalid_retry_count() -> None:
    with pytest.raises(ValueError):
        _source(retries=0)


def test_context_manager_closes_the_client() -> None:
    client = httpx.Client()
    with WorldBankApiSource(clock=FixedClock(), client=client) as source:
        assert source._client is client
    assert client.is_closed
