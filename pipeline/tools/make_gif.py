"""Stitch the Playwright frame sequence into the README hero GIF.

Usage:
    uv run --directory pipeline python tools/make_gif.py \
        --frames ../.generated/frames --out ../docs/media/hero.gif \
        --width 960 --duration-ms 900

Frames are loaded in filename order, resized to a common width with their
aspect ratio preserved, reduced to an adaptive 128-colour palette and written
as an infinite-loop GIF. The committed `npm run capture:media` command runs it
after the Playwright capture project.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

from PIL import Image


def positive_int(value: str) -> int:
    """Parse a strictly positive integer argument."""
    number = int(value)
    if number <= 0:
        raise argparse.ArgumentTypeError(f"expected a positive integer, got {value}")
    return number


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--frames", type=Path, required=True, help="directory of PNG frames")
    parser.add_argument("--out", type=Path, required=True, help="output .gif path")
    parser.add_argument("--width", type=positive_int, default=960, help="output width in pixels")
    parser.add_argument(
        "--duration-ms",
        type=positive_int,
        default=900,
        help="per-frame duration in milliseconds",
    )
    return parser.parse_args(argv)


def frame_paths(directory: Path) -> list[Path]:
    """Return PNG frames sorted by name."""
    return sorted(path for path in directory.glob("*.png") if path.is_file())


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    frames = frame_paths(args.frames)
    if not frames:
        sys.stderr.write(f"no PNG frames found in {args.frames}\n")
        return 2

    with Image.open(frames[0]) as first:
        aspect = first.height / first.width
    height = max(1, round(args.width * aspect))

    images: list[Image.Image] = []
    for path in frames:
        with Image.open(path) as frame:
            resized = frame.convert("RGB").resize((args.width, height), Image.Resampling.LANCZOS)
            images.append(resized.convert("P", palette=Image.Palette.ADAPTIVE, colors=128))

    args.out.parent.mkdir(parents=True, exist_ok=True)
    first_image, *rest = images
    first_image.save(
        args.out,
        format="GIF",
        save_all=True,
        append_images=rest,
        duration=args.duration_ms,
        loop=0,
        optimize=True,
    )
    print(f"wrote {args.out} with {len(images)} frames at {args.width}x{height}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
