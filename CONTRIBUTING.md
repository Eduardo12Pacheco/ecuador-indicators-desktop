# Contributing

## Setup

Requirements: Node.js 26 (or >= 24), Rust 1.95+, and uv for the data pipeline.

```bash
npm ci
cd pipeline && uv sync --frozen
```

## Commands

| Area | Command |
|---|---|
| Fast web checks | `npm run verify:fast` |
| Lint | `npm run lint` |
| Types | `npm run typecheck` |
| Unit tests | `npm test` |
| Pipeline lint, types and tests | `cd pipeline && uv run ruff check . && uv run ruff format --check . && uv run mypy --strict src && uv run pytest -q` |
| Rust checks | `cargo fmt --all --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace` |

## Commit convention

Use Conventional Commits in English (`feat(scope): ...`, `fix(scope): ...`,
`test(scope): ...`, `docs: ...`, `ci: ...`, `build: ...`, `chore: ...`).
Do not add AI attribution trailers. Keep each commit focused and reviewable.

## Pull requests

- Tests accompany behavior changes; never weaken or delete a test to get green.
- Respect the hexagonal dependency rules documented in `docs/ARCHITECTURE.md`.
- Keep user-facing strings in both English and Spanish dictionaries.
