"""System clock adapter."""

from __future__ import annotations

from datetime import UTC, datetime


class SystemClock:
    """Wall-clock implementation of the ``Clock`` port."""

    def now(self) -> datetime:
        return datetime.now(UTC)

    def now_iso(self) -> str:
        return self.now().isoformat(timespec="seconds")
