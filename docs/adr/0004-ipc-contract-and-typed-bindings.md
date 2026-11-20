# ADR 0004: IPC contract and typed bindings

## Status

Accepted

## Context

The React UI must call the Rust shell without ad-hoc JSON handling in every
component. Every command also needs one stable error shape so the UI can show a
meaningful state instead of parsing prose. The contract has to be checkable in
CI: a changed Rust DTO must fail the build when the committed TypeScript
bindings were not regenerated.

## Decision

Expose exactly fourteen `async` Tauri commands (D24). Every command:

- is registered by `src-tauri/src/lib.rs::configure_builder`, which is generic
  over `tauri::Runtime` so `tauri::test::mock_builder` exercises the identical
  handler;
- runs blocking SQLite/filesystem work inside
  `tauri::async_runtime::spawn_blocking` and returns `Result<T, ErrorDto>`;
- maps every `CoreError` to its stable code (`SNAPSHOT_INVALID`,
  `SNAPSHOT_NOT_FOUND`, `VIEW_NOT_FOUND`, `VIEW_INVALID`, `LIMIT_EXCEEDED`,
  `STORAGE`, `EXPORT_REJECTED`, `UPDATE_FEED`, `NETWORK`, `INTERNAL`).

| Command | Arguments | Returns |
|---|---|---|
| `app_info` | none | `AppInfo {version, platform, data_dir, log_dir}` |
| `dataset_info` | none | `DatasetInfo` |
| `dataset_catalog` | none | `Catalog` |
| `dataset_observations` | `codes: string[]`, `iso3s: string[]` | `Observation[]` |
| `dataset_open_snapshot` | `path: string` | `DatasetInfo` |
| `dataset_reset_snapshot` | none | `DatasetInfo` |
| `views_list` | none | `SavedView[]` |
| `views_create` | `view: NewView` | `SavedView` |
| `views_update` | `id: string`, `view: NewView` | `SavedView` |
| `views_delete` | `id: string` | `void` |
| `settings_get` | none | `Settings` |
| `settings_set` | `settings: Settings` | `void` |
| `export_save` | `path: string`, `content: number[]` | saved path string |
| `updates_check` | `force: boolean` | `UpdateStatus` |

The core DTOs derive `serde` and `ts_rs::TS`; `AppInfo` lives in the shell and
also derives both. `cargo test` writes the committed bindings under
`src/adapters/tauri/generated/` (19 core files plus `AppInfo.ts`). T6 adds zod
schemas that are statically checked against these generated types and a
`check:bindings` drift gate (T13 wraps it in `scripts/check-bindings-drift.mjs`).

Arguments follow Tauri's default camelCase-to-snake_case conversion, so the UI
calls `dataset_open_snapshot` with `{ path }`, `views_create` with `{ view }`,
`dataset_observations` with `{ codes, iso3s }` and `updates_check` with
`{ force }`. `export_save` returns the destination path so the success toast can
name it; the path is already known to the UI but returning it keeps the command
self-consistent.

`--self-check` intentionally does not use the IPC layer: it runs before Tauri
starts, resolves the same typed directories from `AppConfig`, opens the same
read-only snapshot reader and the same migrated user store.

## Consequences

- The UI cannot invent a command or an error code; a missing handler is a
  compile-time failure in the shell tests.
- A DTO change without regenerating the bindings dirties the working tree and
  fails CI.
- The shell must keep its own directory resolution (`config.rs`) in sync with
  Tauri's `app_data_dir`/`app_log_dir` semantics, because self-check has no
  `AppHandle`. The resolver mirrors Tauri's documented platform paths and is
  covered by unit tests; if Tauri changes those paths, a single module updates.
- `AppInfo` is the only IPC type defined outside the core crate. It exists for
  operating-system facts, not domain concepts; keeping it in the shell avoids
  leaking filesystem paths into the pure core.

## Alternatives

- **Return `serde_json::Value` from commands**: no bindings, no drift check, and
  every component would re-validate payloads.
- **A separate `ipc-contract` crate**: one more compilation unit for one DTO;
  the core already owns every wire type except `AppInfo`.
- **OpenAPI/JSON-RPC generation**: adds a server-shaped toolchain to a desktop
  IPC boundary that Tauri already models natively.
