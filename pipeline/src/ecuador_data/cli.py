"""Command line interface for the Ecuador Indicators data pipeline."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

import typer

from ecuador_data import __version__
from ecuador_data.adapters.clock import SystemClock
from ecuador_data.adapters.raw_cache import FileRawStore
from ecuador_data.adapters.sqlite_snapshot import SqliteSnapshotWriter
from ecuador_data.adapters.worldbank_api import WorldBankApiSource
from ecuador_data.application.build import BuildUseCase
from ecuador_data.application.refresh import RefreshUseCase
from ecuador_data.application.verify import VerifyUseCase
from ecuador_data.domain.catalog import load_catalog
from ecuador_data.domain.errors import (
    CatalogError,
    IntegrityError,
    ManifestError,
    SourceProtocolError,
    SourceUnavailableError,
)
from ecuador_data.logging import configure_logging
from ecuador_data.settings import Settings

app = typer.Typer(
    name="ecuador-data",
    help="Refresh, build and verify the Ecuador Indicators dataset.",
    no_args_is_help=True,
)

DATA_DIR_OPTION = typer.Option(
    None, "--data-dir", help="Data directory (default: ECUADOR_DATA_DATA_DIR or ./data)."
)


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"ecuador-data {__version__}")
        raise typer.Exit


@app.callback()
def main(
    version: bool = typer.Option(
        False,
        "--version",
        help="Show the pipeline version and exit.",
        callback=_version_callback,
        is_eager=True,
    ),
) -> None:
    """Ecuador Indicators data pipeline."""


def _settings(data_dir: Path | None) -> Settings:
    settings = Settings()
    if data_dir is not None:
        settings = settings.model_copy(update={"data_dir": data_dir})
    configure_logging(settings.log_level)
    return settings


def _run(action: Callable[[], None], *, label: str) -> None:
    try:
        action()
    except (CatalogError, IntegrityError, ManifestError) as exc:
        typer.echo(f"{label}: {exc}", err=True)
        raise typer.Exit(2) from exc
    except (SourceUnavailableError, SourceProtocolError) as exc:
        typer.echo(f"{label}: {exc}", err=True)
        raise typer.Exit(3) from exc
    except typer.Exit:
        raise
    except Exception as exc:
        typer.echo(f"{label}: unexpected error: {exc}", err=True)
        raise typer.Exit(1) from exc


@app.command()
def refresh(data_dir: Path | None = DATA_DIR_OPTION) -> None:
    """Fetch World Bank metadata and observations into the raw cache."""

    def action() -> None:
        settings = _settings(data_dir)
        catalog = load_catalog()
        source = WorldBankApiSource(
            clock=SystemClock(),
            timeout_s=settings.http_timeout_s,
            retries=settings.http_retries,
            user_agent=settings.user_agent,
        )
        try:
            result = RefreshUseCase(
                source=source,
                store=FileRawStore(settings.data_dir),
                clock=SystemClock(),
                catalog=catalog,
            ).execute()
        finally:
            source.close()
        typer.echo(f"refreshed {result.raw_files} raw files into {settings.data_dir}")
        typer.echo(f"manifest: {result.manifest_path}")
        typer.echo(f"source_last_updated: {result.source_last_updated}")

    _run(action, label="refresh")


@app.command()
def build(
    data_dir: Path | None = DATA_DIR_OPTION,
    out: Path | None = typer.Option(
        None, "--out", help="Snapshot output path (default: <data-dir>/snapshot/...)."
    ),
) -> None:
    """Build the deterministic SQLite snapshot from the raw cache."""

    def action() -> None:
        settings = _settings(data_dir)
        result = BuildUseCase(
            store=FileRawStore(settings.data_dir),
            writer=SqliteSnapshotWriter(),
            catalog=load_catalog(),
        ).execute(out)
        typer.echo(f"built {result.path}")
        typer.echo(f"logical_sha256: {result.logical_sha256}")
        typer.echo(
            "counts: "
            f"topics={result.topics} geographies={result.geographies} "
            f"indicators={result.indicators} observations={result.observations}"
        )

    _run(action, label="build")


@app.command()
def verify(data_dir: Path | None = DATA_DIR_OPTION) -> None:
    """Verify raw checksums, the snapshot schema, counts and hashes."""

    def action() -> None:
        settings = _settings(data_dir)
        result = VerifyUseCase(
            store=FileRawStore(settings.data_dir),
            writer=SqliteSnapshotWriter(),
        ).execute()
        typer.echo("verify: ok")
        typer.echo(
            "counts: "
            f"topics={result.topics} geographies={result.geographies} "
            f"indicators={result.indicators} observations={result.observations}"
        )
        typer.echo(f"logical_sha256: {result.logical_sha256}")
        typer.echo(f"snapshot_sha256: {result.snapshot_sha256}")

    _run(action, label="verify")


__all__ = [
    "app",
    "build",
    "refresh",
    "verify",
]
