"""Unit tests for structured logging configuration."""

from __future__ import annotations

import logging

from ecuador_data.logging import configure_logging, get_logger


def test_configure_logging_json_and_console(capsys: object) -> None:
    configure_logging("DEBUG")
    get_logger("test").info("json message")
    configure_logging("INFO", json_output=False)
    get_logger("test").info("console message")
    assert logging.getLogger().level == logging.INFO
