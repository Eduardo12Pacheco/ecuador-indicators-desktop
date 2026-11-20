# ecuador-data

Python data pipeline for the Ecuador Indicators desktop application. It
refreshes World Bank WDI raw data, builds the bundled SQLite snapshot, verifies
integrity, imports optional lakehouse exports and derives the JSON fixtures used
by the in-memory adapter.

```bash
uv sync --frozen

uv run ecuador-data refresh          # network: World Bank API v2 -> data/raw
uv run ecuador-data build            # offline, deterministic -> data/snapshot
uv run ecuador-data verify           # checksums, schema, counts, hashes
uv run ecuador-data build --subset mini --out ../crates/indicators-core/tests/fixtures/mini.snapshot.sqlite
uv run ecuador-data export-json --subset mini --out ../src/adapters/memory/fixtures/mini.snapshot.json
uv sync --extra lakehouse
uv run ecuador-data import-lakehouse --manifest manifest.json --out custom.sqlite
```

The full guide, data sources, integrity model and limitations are in
[`docs/DATA.md`](../docs/DATA.md); the lakehouse contract is in
[`docs/LAKEHOUSE-MANIFEST.md`](../docs/LAKEHOUSE-MANIFEST.md). All commands write
to the repository `data/` directory by default; override it with
`ECUADOR_DATA_DATA_DIR`.
