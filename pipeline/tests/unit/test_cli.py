from typer.testing import CliRunner

from ecuador_data import __version__
from ecuador_data.cli import app

runner = CliRunner()


def test_version_flag_prints_version() -> None:
    result = runner.invoke(app, ["--version"])
    assert result.exit_code == 0
    assert f"ecuador-data {__version__}" in result.stdout


def test_help_lists_the_cli() -> None:
    result = runner.invoke(app, ["--help"])
    assert result.exit_code == 0
    assert "ecuador-data" in result.stdout
