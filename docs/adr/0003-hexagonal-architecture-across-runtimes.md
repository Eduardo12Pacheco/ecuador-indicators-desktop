# ADR 0003: Hexagonal architecture across Rust, TypeScript and Python

## Status

Accepted

## Context

The application ships three runtimes: a thin Rust desktop shell, a TypeScript
UI, and a Python data pipeline. Without an explicit boundary, product logic
drifts into Tauri commands or React components and the "typed core" becomes a
slogan. The desktop shell also has to stay replaceable: the same services must
be testable without a window, and the data pipeline must never be imported by
the desktop runtime.

## Decision

Apply one hexagonal model to every runtime:

| Runtime | Domain / application | Ports | Adapters | Composition root |
|---|---|---|---|---|
| TypeScript | `src/core/domain`, `src/core/application` | `src/core/application/ports.ts` | `src/adapters/{tauri,memory}` | `src/app/bootstrap.ts` |
| Rust core | `crates/indicators-core/src/{domain,application}` | `ports.rs` | `crates/indicators-core/src/adapters` | `src-tauri/src/lib.rs` |
| Python | `pipeline/src/ecuador_data/{domain,application}` | `ports.py` | `pipeline/src/ecuador_data/adapters` | `pipeline/src/ecuador_data/cli.py` |

Dependency direction points inward only. `src-tauri` is a composition root: it
parses CLI arguments, resolves typed configuration, opens the bundled snapshot,
wires core adapters, creates the window and exposes IPC commands. It contains
no analytical or persistence logic of its own. The Rust core never depends on
Tauri; the Python domain never imports HTTP or SQLite; the TypeScript core never
imports React, Tauri or ECharts.

The rules are executable, not prose: `pipeline` uses import-linter contracts,
`crates/indicators-core/tests/architecture.rs` scans source tokens and the
Cargo dependency graph, and `src/architecture.test.ts` (T6) builds the TS import
graph. Wire DTOs are the Rust domain types themselves (`serde` plus `ts-rs`),
so there is exactly one source of truth for the IPC contract; the TypeScript
adapter maps them into its branded domain model. That is a deliberate trade-off:
a duplicated DTO layer would add drift risk without adding safety.

## Consequences

- Services are testable with in-memory fakes and real temp SQLite files, with no
  desktop runtime. The shell tests use `tauri::test::mock_builder` and the same
  command handler the UI calls.
- Adding UI-only behavior must go through a use case or stay in `src/ui`; the
  architecture tests fail on reverse imports.
- The shell can grow only through ports: a new OS integration means a new trait
  in the core plus an adapter, not a call from a component.
- The trade-off is that Rust domain types carry wire concerns (`serde`,
  `ts-rs`). It is accepted because the alternative duplicates every field in a
  second DTO layer and creates a second drift surface.

## Alternatives

- **Fat Tauri shell**: fastest to write, but ties all logic to the desktop
  runtime and makes the fast TypeScript test loop impossible.
- **Separate IPC DTO crate**: isolates wire types, but doubles the contract and
  requires mapping tests in both directions.
- **One repository layer shared by all runtimes**: impossible across languages
  and would hide the SQLite boundary that S34 requires.
