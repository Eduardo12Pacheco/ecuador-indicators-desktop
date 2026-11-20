# ADR 0002: Python data pipeline and schema-v1 snapshot

## Status

Accepted

## Context

Ecuador Indicators ships a bundled, offline snapshot of 38 World Bank World
Development Indicators for seven geographies. The snapshot must be reproducible
from a committed raw cache, must be verifiable byte for byte, and must be
consumed read-only by the desktop runtime. The owner's strongest language is
Python, and the data lineage should be visible and testable independently of
the desktop application.

The World Bank WDI API v2 needs no key, returns JSON with pagination, and
publishes under CC BY 4.0 with per-indicator upstream providers. Names and
descriptions exist in English and Spanish. Some series are modelled estimates
and many have multi-year reporting lags, so the artifact must record what was
retrieved and when rather than imply that missing years are zero.

## Decision

Keep a separate Python package, `pipeline/` (`ecuador-data`), with the same
hexagonal rules as the other runtimes: a pure `domain`, `application` use cases,
`ports` and `adapters`. It owns four artifacts and commands:

- `refresh` fetches English and Spanish metadata plus one observation file per
  indicator from `https://api.worldbank.org/v2`, writes canonical JSON
  (`sort_keys`, compact separators, UTF-8, trailing newline) under `data/raw/`,
  and records URL, retrieval time, byte size and SHA-256 per file in
  `data/MANIFEST.json`.
- `build` is offline and deterministic: it reads the raw cache, verifies every
  file against the manifest, and writes a SQLite database with schema version 1
  (`PRAGMA user_version = 1`, tables `meta`, `topic`, `geography`, `indicator`,
  `observation`, all `WITHOUT ROWID` unless noted, foreign keys enabled).
- `verify` rechecks raw checksums, the snapshot file hash, the schema, counts and
  the recomputed logical hash, exiting `2` on any mismatch.
- `export-json` derives the JSON shape used by the in-memory adapter and test
  fixtures; `--subset mini` selects the committed six-indicator, five-geography
  catalog in `pipeline/catalog/mini.toml`.

Two hashes have different jobs. `meta.logical_sha256` is computed over a
canonical, ordered text dump of every table (topic, geography, indicator,
observation, meta excluding the hash itself). It proves that the content is
reproducible from the raw cache regardless of row insertion order or SQLite
page layout. `data/MANIFEST.json` also records the SHA-256 of the snapshot file
bytes, which proves that the shipped file is the committed one. The Rust runtime
only checks the schema, counts and `PRAGMA quick_check`; it deliberately does
not recompute the logical hash, because that would couple two languages to one
float-formatting convention.

Exit codes are part of the contract: `0` success, `1` unexpected error, `2`
integrity/validation failure, `3` source unavailable or protocol error.

## Consequences

- The raw cache and the snapshot are committed, so a contributor can run
  `build` and `verify` offline. The trade-off is repository size (the raw cache
  is a few megabytes); it is generated data and never edited by hand.
- Determinism depends on canonical JSON input and ordered inserts. Float values
  are stored as JSON numbers and formatted for hashing with Python's `repr`,
  which round-trips IEEE-754 doubles exactly.
- The desktop runtime has no Python or DuckDB dependency: it reads a SQLite file
  with a fixed schema. Custom snapshots must satisfy the same schema.
- Updating the dataset is an explicit `refresh` plus a review of the generated
  `data/` diff; the app cannot silently change data.
- The World Bank licence and attribution live in `meta` and in the application's
  About screen, not only in the repository documentation.

## Alternatives

- **Fetch the API at runtime**: breaks offline-first (S1) and makes the dataset
  non-reproducible.
- **CSV as the intermediate format**: loses types and nested metadata; canonical
  JSON matches the API shape and is easy to diff.
- **Parquet or DuckDB as the bundled artifact**: heavier for the desktop runtime
  and adds a native dependency to three operating systems for no user benefit.
- **A single file hash only**: the file hash changes with SQLite page layout and
  cannot distinguish a rebuilt-but-equivalent snapshot from changed content.
- **No raw cache in git**: saves space but makes the build unverifiable and
  irreproducible offline.
