"""Command line interface for the Ecuador Indicators data pipeline."""

import typer

from ecuador_data import __version__

app = typer.Typer(
    name="ecuador-data",
    help="Refresh, build and verify the Ecuador Indicators dataset.",
    no_args_is_help=True,
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
