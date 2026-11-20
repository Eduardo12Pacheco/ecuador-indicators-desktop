# Testing guide

This guide describes the test layers, the exact commands and the determinism
rules used by the repository. It is the human-readable companion to the CI
workflow.

## Pyramid

| Layer | Runner | Location | What it proves |
|---|---|---|---|
| Pure TypeScript unit and property tests | Vitest 5 + fast-check | `src/core/**/*.test.ts` | transforms, statistics, CSV, search, view state, use cases |
| Component and provider tests | Vitest + Testing Library | `src/ui/**/*.test.tsx` | keyboard behavior, validation, empty/error/loading states, axe (jsdom) |
| Script tests | Vitest | `scripts/__tests__` | version sync, bundle budget, artifact collection |
| Rust unit, integration and property tests | `cargo test` + proptest | `crates/indicators-core`, `src-tauri` | snapshot contracts, user store, update feed, IPC commands |
| Python unit and integration tests | pytest + Hypothesis | `pipeline/tests` | catalog, World Bank adapter, snapshot build/verify, lakehouse import |
| Browser end-to-end and accessibility | Playwright 1.65 (Chromium + WebKit) | `e2e/` | real routing, persistence, downloads, keyboard flows and axe WCAG scans |
| Native end-to-end | WebdriverIO + tauri-driver | `e2e-native/` (T12) | the real desktop window on Linux |
| Data reproducibility | `ecuador-data verify` | `data/` | raw checksums, schema counts and the logical hash |

## Commands

```bash
# Fast TypeScript loop
npm run test
npm run test:cov          # enforces the coverage thresholds
npm run typecheck
npm run lint

# Browser end-to-end (builds the e2e bundle and starts Vite preview)
npx playwright install chromium webkit
npm run test:e2e
npx playwright test --project=chromium
npx playwright test --project=webkit
npx playwright test e2e/offline.spec.ts --project=chromium

# Rust
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
cargo fmt --all --check

# Python
cd pipeline
uv sync --frozen
uv run pytest -q
uv run ruff check . && uv run ruff format --check .
uv run mypy --strict src
```

`npm run test:e2e` uses `playwright.config.ts`: it runs `npm run build:e2e`
(mini JSON snapshot through the in-memory adapter) and then serves `dist/` on
port 4173. `e2e/media/**` belongs to the capture project and is ignored by the
default run.

## What the E2E suite covers

- `explore.spec.ts`: default GDP, KPI cards, YoY transform and URL state,
  peers, range presets and the data-table alternative.
- `compare.spec.ts`: trajectory base year, the four-indicator cap, ranking
  order, Ecuador highlight, missing geographies last and tab routing.
- `palette.spec.ts`: `Mod+K`, Spanish diacritic-insensitive search, Enter,
  Escape focus restoration, empty results and geography actions.
- `views.spec.ts`: save through `Mod+S`, reload persistence, reopen restoring
  the exact URL state, rename and delete confirmation.
- `export.spec.ts`: exact CSV header, row count and values; PNG signature.
- `settings.spec.ts`: immediate theme/language application and persistence,
  update switch off by default, no update request on launch, dataset counts.
- `states.spec.ts`: empty state, retry after an injected fault, and the
  dataset-problem screen with recovery.
- `keyboard.spec.ts`: skip link, palette, catalog arrows, chart scrubbing,
  save dialog and shortcuts dialog without a mouse.
- `offline.spec.ts`: Explore → Compare → Save → Export with a network guard
  that aborts non-localhost requests and asserts zero attempts (S1).
- `layout.spec.ts`: 960×640 minimum window, collapsed sidebar, no horizontal
  scroll and no clipped primary actions.
- `a11y.spec.ts`: axe with `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` over
  every route × theme × language (28 scans) plus the palette, save, shortcuts
  and delete dialogs (32 tests total).

The suite never uses sleeps (`waitForTimeout` is forbidden); it relies on
web-first assertions and user-visible state.

## Determinism rules

- No test performs a real network request. The World Bank adapter uses
  `respx` fixtures; the GitHub release feed uses `httpmock` and a recorded
  JSON fixture; browser tests use the bundled mini snapshot.
- The in-memory adapter reads one JSON file per browser context. Tests seed
  `localStorage` before the first paint and never share state between tests.
- Property tests use fixed seeds: fast-check seed in `vitest.config.ts`,
  Hypothesis `derandomize` in CI and `PROPTEST_RNG_SEED` for Rust.
- Rust, Python and the user store integration tests use real SQLite files in
  temporary directories.
- Screenshots and traces are only written on failure (`test-results/`), and the
  capture project in `e2e/media/` is documentation, not assertions.

## Local environment notes

Playwright's WebKit download needs the Ubuntu packages `libicu74` and
`libxml2`; CI installs them with `npx playwright install --with-deps`. On a
workstation without sudo, extract those two runtime packages into the
Playwright browser cache and run with
`PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1`; this is a local-only workaround,
not a repository requirement. Native E2E is Linux-only by design (ADR 0007).

## Coverage and gates

| Gate | Threshold | Where |
|---|---|---|
| Vitest lines/statements/functions | 85 % | `vitest.config.ts`, `npm run test:cov` |
| Vitest branches | 80 % | `vitest.config.ts` |
| `src/core/**` | 95 % lines/statements/functions, 90 % branches | `vitest.config.ts` |
| Rust `indicators-core` lines | 85 % | CI via `cargo llvm-cov` |
| Python `pipeline/src` | 85 % | pytest addopts |

Numbers measured on the current commit are reported in the task log and in
`docs/TESTING.md` when the final verification task closes the plan.
