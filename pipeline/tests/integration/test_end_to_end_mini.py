"""End-to-end test: build twice, verify, and detect a mutated raw file."""

from __future__ import annotations

import re
import shutil
from pathlib import Path

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st
from typer.testing import CliRunner

from ecuador_data.cli import app

FIXTURE = Path(__file__).resolve().parents[1] / "fixtures" / "mini_raw"
runner = CliRunner()


def _hash(output: str) -> str:
    match = re.search(r"logical_sha256: ([0-9a-f]{64})", output)
    assert match is not None, output
    return match.group(1)


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    target = tmp_path / "data"
    shutil.copytree(FIXTURE, target)
    return target


def test_build_twice_then_verify(data_dir: Path, tmp_path: Path) -> None:
    first = runner.invoke(
        app, ["build", "--data-dir", str(data_dir), "--out", str(tmp_path / "a.sqlite")]
    )
    second = runner.invoke(
        app, ["build", "--data-dir", str(data_dir), "--out", str(tmp_path / "b.sqlite")]
    )
    assert first.exit_code == 0, first.stderr
    assert second.exit_code == 0, second.stderr
    assert _hash(first.stdout) == _hash(second.stdout)

    verified = runner.invoke(app, ["verify", "--data-dir", str(data_dir)])
    assert verified.exit_code == 0, verified.stderr
    assert _hash(verified.stdout) == _hash(first.stdout)


def test_verify_fails_after_a_single_byte_change(data_dir: Path) -> None:
    target = data_dir / "raw" / "worldbank" / "observations" / "NY.GDP.MKTP.CD.json"
    data = target.read_bytes()
    target.write_bytes(data[:-1] + bytes([data[-1] ^ 0x01]))
    result = runner.invoke(app, ["verify", "--data-dir", str(data_dir)])
    assert result.exit_code == 2
    assert "checksum mismatch" in result.stderr
    assert "raw/worldbank/observations/NY.GDP.MKTP.CD.json" in result.stderr


@given(seed=st.integers(min_value=0, max_value=2**31 - 1))
@settings(
    max_examples=10, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture]
)
def test_verify_fails_after_any_single_byte_change(data_dir: Path, seed: int) -> None:
    target = data_dir / "raw" / "worldbank" / "observations" / "SI.POV.NAHC.json"
    original = target.read_bytes()
    offset = seed % len(original)
    mutated = bytearray(original)
    mutated[offset] ^= 0x01
    target.write_bytes(bytes(mutated))
    try:
        result = runner.invoke(app, ["verify", "--data-dir", str(data_dir)])
    finally:
        target.write_bytes(original)
    assert result.exit_code == 2
    assert "checksum mismatch" in result.stderr
    assert "raw/worldbank/observations/SI.POV.NAHC.json" in result.stderr


def test_canonical_build_refreshes_the_manifest_and_still_verifies(data_dir: Path) -> None:
    built = runner.invoke(app, ["build", "--data-dir", str(data_dir)])
    assert built.exit_code == 0, built.stderr
    verified = runner.invoke(app, ["verify", "--data-dir", str(data_dir)])
    assert verified.exit_code == 0, verified.stderr
    assert _hash(built.stdout) == _hash(verified.stdout)
