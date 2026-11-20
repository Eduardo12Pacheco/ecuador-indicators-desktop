"""World Bank Indicators API v2 adapter.

No API key is required. The adapter paginates, retries transient failures with
a bounded backoff and turns the API error envelope into a typed error so the
CLI can exit with the documented codes.
"""

from __future__ import annotations

import time
from collections.abc import Mapping, Sequence
from datetime import UTC
from typing import Any, cast

import httpx

from ecuador_data.domain.errors import SourceProtocolError, SourceUnavailableError
from ecuador_data.domain.models import ObservationPage
from ecuador_data.ports import Clock

API_ROOT = "https://api.worldbank.org/v2"
BACKOFF_SECONDS = (0.5, 1.0, 2.0, 4.0)
RETRYABLE_STATUS = frozenset({429, 500, 502, 503, 504})
HTTP_BAD_REQUEST = 400
PAGE_PAIR_SIZE = 2
DEFAULT_PER_PAGE = 20_000


class WorldBankApiSource:
    """``IndicatorSource`` over ``https://api.worldbank.org/v2``."""

    def __init__(
        self,
        *,
        clock: Clock,
        timeout_s: float = 30.0,
        retries: int = 4,
        user_agent: str = "ecuador-data",
        client: httpx.Client | None = None,
    ) -> None:
        if retries < 1:
            raise ValueError("retries must be at least 1")
        self._clock = clock
        self._retries = retries
        self._client = client or httpx.Client(
            timeout=timeout_s,
            headers={"User-Agent": user_agent, "Accept": "application/json"},
            follow_redirects=True,
        )

    def __enter__(self) -> WorldBankApiSource:
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()

    def close(self) -> None:
        self._client.close()

    # -- HTTP ---------------------------------------------------------------
    def _sleep(self, seconds: float) -> None:
        time.sleep(seconds)

    def _get_json(self, url: str, params: Mapping[str, Any]) -> Any:
        last_error = "no attempt made"
        for attempt in range(self._retries):
            try:
                response = self._client.get(url, params=params)
            except httpx.TimeoutException as exc:
                last_error = f"timeout: {exc}"
            except httpx.TransportError as exc:
                last_error = f"transport error: {exc}"
            else:
                if response.status_code in RETRYABLE_STATUS:
                    last_error = f"HTTP {response.status_code}"
                elif response.status_code >= HTTP_BAD_REQUEST:
                    raise SourceUnavailableError(
                        f"World Bank API returned HTTP {response.status_code} for {url}"
                    )
                else:
                    try:
                        payload: Any = response.json()
                    except ValueError as exc:
                        raise SourceProtocolError(
                            f"World Bank API returned invalid JSON for {url}"
                        ) from exc
                    self._reject_error_envelope(payload, url)
                    return payload
            if attempt + 1 < self._retries:
                self._sleep(BACKOFF_SECONDS[min(attempt, len(BACKOFF_SECONDS) - 1)])
        raise SourceUnavailableError(
            f"World Bank API unavailable after {self._retries} attempts for {url}: {last_error}"
        )

    @staticmethod
    def _reject_error_envelope(payload: Any, url: str) -> None:
        if isinstance(payload, list) and payload:
            first = payload[0]
            if isinstance(first, dict) and "message" in first:
                message = first.get("message")
                raise SourceProtocolError(f"World Bank API error envelope for {url}: {message}")

    @staticmethod
    def _page(payload: Any, url: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        if not isinstance(payload, list) or len(payload) != PAGE_PAIR_SIZE:
            raise SourceProtocolError(f"unexpected World Bank payload shape for {url}")
        meta, rows = payload
        if not isinstance(meta, dict) or not isinstance(rows, list):
            raise SourceProtocolError(f"unexpected World Bank payload shape for {url}")
        page_meta = cast(dict[str, Any], meta)
        page_rows = [cast(dict[str, Any], row) for row in rows if isinstance(row, dict)]
        return page_meta, page_rows

    def _collect(
        self, url: str, params: Mapping[str, Any]
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        payload = self._get_json(url, params)
        meta, rows = self._page(payload, url)
        collected = list(rows)
        page = int(meta.get("page", 1) or 1)
        pages = int(meta.get("pages", 1) or 1)
        while page < pages:
            page += 1
            page_params = dict(params)
            page_params["page"] = page
            payload = self._get_json(url, page_params)
            page_meta, page_rows = self._page(payload, url)
            collected.extend(page_rows)
            page = int(page_meta.get("page", page) or page)
            pages = int(page_meta.get("pages", pages) or pages)
        return meta, collected

    # -- IndicatorSource ----------------------------------------------------
    def fetch_indicators(self, codes: Sequence[str], *, language: str) -> list[dict[str, object]]:
        prefix = "/es" if language == "es" else ""
        indicators: list[dict[str, object]] = []
        for code in codes:
            url = f"{API_ROOT}{prefix}/indicator/{code}"
            payload = self._get_json(url, {"format": "json", "per_page": 100})
            _meta, rows = self._page(payload, url)
            if not rows:
                raise SourceProtocolError(f"World Bank API returned no metadata for {code}")
            indicators.append(rows[0])
        return indicators

    def fetch_countries(self, iso3s: Sequence[str], *, language: str) -> list[dict[str, object]]:
        prefix = "/es" if language == "es" else ""
        url = f"{API_ROOT}{prefix}/country/{';'.join(iso3s)}"
        _meta, rows = self._collect(url, {"format": "json", "per_page": 100})
        found = {str(row.get("id", "")) for row in rows}
        missing = [iso3 for iso3 in iso3s if iso3 not in found]
        if missing:
            raise SourceProtocolError(
                "World Bank API returned no metadata for geographies: " + ", ".join(missing)
            )
        return rows

    def fetch_observations(
        self, codes: Sequence[str], iso3s: Sequence[str], *, language: str = "en"
    ) -> dict[str, ObservationPage]:
        retrieved_at = self._clock.now().astimezone(UTC).isoformat(timespec="seconds")
        pages: dict[str, ObservationPage] = {}
        for code in codes:
            url = f"{API_ROOT}/country/{';'.join(iso3s)}/indicator/{code}"
            meta, rows = self._collect(
                url,
                {
                    "format": "json",
                    "per_page": DEFAULT_PER_PAGE,
                    "date": "1960:2026",
                },
            )
            non_null = [row for row in rows if row.get("value") is not None]
            non_null.sort(
                key=lambda row: (
                    str(row.get("countryiso3code", "")),
                    str(row.get("date", "")),
                )
            )
            pages[code] = ObservationPage(
                url=url,
                retrieved_at=retrieved_at,
                source_id=str(meta.get("sourceid", "") or ""),
                last_updated=str(meta.get("lastupdated", "") or ""),
                rows=tuple(non_null),
            )
        return pages
