# ADR 0009: Lakehouse manifest v1 contract

## Status

Accepted. The contract is proposed by this repository: no sibling lakehouse
artifact existed to align with when it was written.

## Context

The optional lakehouse integration must let a sibling project export data from
DuckDB into an Ecuador Indicators snapshot without linking DuckDB into the
desktop runtime. The desktop ships on three operating systems, and a native
DuckDB build would add packaging, size and maintenance cost for an optional
feature. The integration also needs a stable, documented, versioned boundary
rather than ad-hoc SQL knowledge of a sibling repository.

## Decision

Define a JSON manifest, version `1.x`, that describes a DuckDB file and maps its
relations and columns onto the five schema-v1 snapshot tables. The full contract
is in [`docs/LAKEHOUSE-MANIFEST.md`](../LAKEHOUSE-MANIFEST.md) and is encoded in
[`pipeline/schemas/lakehouse-manifest.v1.schema.json`](../../pipeline/schemas/lakehouse-manifest.v1.schema.json)
(JSON Schema draft 2020-12).

Key points:

- `manifest_version` major must be `1`; a different major is rejected. The minor
  version is informative and future minor versions may add optional fields.
- `kind` must be `ecuador-indicators-lakehouse-export`.
- `duckdb.path` is relative to the manifest, must not escape its directory, and
  the file bytes must match `duckdb.sha256`.
- Relations and column identifiers must match
  `^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$`. This is validated before
  any SQL is built, and identifiers are quoted, so the contract has no SQL
  injection surface. DuckDB is opened with `read_only=True`.
- Column maps are exact: every snapshot column must be mapped, and no extra
  mapping is accepted. This keeps failures explicit instead of silently dropping
  data.
- The snapshot copies the manifest's licence and attribution texts and records
  `origin = "lakehouse"`. Other provenance fields use the manifest dataset
  metadata (`title`, `version`, `generated_at`).
- Validation failures exit `2` through the CLI and name the offending relation or
  column. Missing `duckdb` in the environment is also reported as a typed error;
  install it with `uv sync --extra lakehouse` (it is a dev dependency, so the
  test suite always has it).

DuckDB remains a Python-only dependency. The desktop runtime never links it.

## Consequences

- The sibling project must produce this manifest and a DuckDB file; the contract
  is the only coupling and is versioned independently.
- Adding a snapshot column requires a manifest minor version and a coordinated
  change here; the schema file and the domain validation are tested against each
  other.
- The import validates referential integrity (indicator topics, observation
  indicators and geographies, duplicate observation keys) before writing, so a
  bad export cannot produce a subtly corrupt snapshot.
- A future major version can change column names or add relations without
  breaking version-1 producers.

## Alternatives

- **Fixed table and column names in the sibling DuckDB**: brittle and impossible
  to version or document without coupling to schema details.
- **Parquet or CSV exchange**: loses nested metadata and typed columns; DuckDB
  is already the sibling's storage format.
- **Link DuckDB into the desktop runtime**: heavier installers and native builds
  on three operating systems for an optional path.
- **Read arbitrary SQL from the manifest**: convenient but unsafe; the explicit
  mapping stays declarative and validated.
