"""Typed errors for the data pipeline.

The CLI maps these errors to the exit codes documented in the plan:
``IntegrityError``, ``ManifestError`` and ``CatalogError`` exit with 2, the
source errors with 3, and anything unexpected with 1.
"""

from __future__ import annotations


class EcuadorDataError(Exception):
    """Base class for every expected pipeline error."""


class CatalogError(EcuadorDataError):
    """The curated catalog is missing data or is internally inconsistent."""


class IntegrityError(EcuadorDataError):
    """A checksum, schema or count does not match what was recorded."""


class ManifestError(EcuadorDataError):
    """The data manifest is missing, malformed or incompatible."""


class SourceUnavailableError(EcuadorDataError):
    """An upstream source could not be reached after the allowed retries."""


class SourceProtocolError(EcuadorDataError):
    """An upstream source answered with an error envelope or unexpected JSON."""
