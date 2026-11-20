"""Record World Bank API fixtures used by the offline test suite.

Run once, with network access, from the pipeline directory::

    uv run python tests/tools/record_fixtures.py

The fixtures are committed so the test suite never touches the network.
"""

from __future__ import annotations

from pathlib import Path

import httpx

from ecuador_data.domain.integrity import canonical_json_bytes

API_ROOT = "https://api.worldbank.org/v2"
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "worldbank"
CODES = ("NY.GDP.MKTP.CD", "SI.POV.NAHC")
GEOS = "ECU;COL;LCN"


def _write(name: str, payload: object) -> None:
    FIXTURES.mkdir(parents=True, exist_ok=True)
    (FIXTURES / name).write_bytes(canonical_json_bytes(payload))
    print(f"wrote {name}")


def main() -> None:
    with httpx.Client(timeout=60.0, follow_redirects=True) as client:
        for code in CODES:
            for language, prefix in (("en", ""), ("es", "/es")):
                response = client.get(
                    f"{API_ROOT}{prefix}/indicator/{code}",
                    params={"format": "json", "per_page": 100},
                )
                response.raise_for_status()
                _write(f"indicator_{code}.{language}.json", response.json())

        for language, prefix in (("en", ""), ("es", "/es")):
            response = client.get(
                f"{API_ROOT}{prefix}/country/{GEOS}",
                params={"format": "json", "per_page": 100},
            )
            response.raise_for_status()
            _write(f"countries.{language}.json", response.json())

        for code in CODES:
            response = client.get(
                f"{API_ROOT}/country/{GEOS}/indicator/{code}",
                params={"format": "json", "per_page": 20000, "date": "1960:2026"},
            )
            response.raise_for_status()
            _write(f"observations_{code}.json", response.json())

    # The API returns an HTML page (not JSON) for unknown indicator codes, so the
    # error-envelope fixture reproduces the documented JSON envelope shape.
    envelope = [
        {
            "message": [
                {
                    "id": "120",
                    "key": "Invalid value",
                    "value": "The provided parameter value is not valid",
                }
            ]
        }
    ]
    _write("error_envelope.json", envelope)


if __name__ == "__main__":
    main()
