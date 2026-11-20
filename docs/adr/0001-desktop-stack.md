# ADR 0001: Tauri 2 desktop shell with a TypeScript UI and a Python data pipeline

## Status

Accepted

## Context

Ecuador Indicators must ship as a polished, installable desktop application on
Linux, Windows and macOS, while staying local-first, offline-capable and free of
mandatory accounts, keys or paid services. The owner is strongest in Python and
wants the data engineering work visible, but the product also needs a modern
UI toolkit, accessible charts, keyboard-first interaction, component tests,
browser end-to-end tests and small, reliable installers.

The repository must demonstrate deliberate architecture across runtimes:
hexagonal layering, typed boundaries, test-first work and three-OS CI/CD.

## Decision

Use Tauri 2 as the desktop shell with a React 19 + TypeScript + Vite frontend.
Keep Rust deliberately thin (OS integration, SQLite, export, update feed) and
put all user-visible domain logic in a pure TypeScript core. Keep data
acquisition, normalization and snapshot building in a separate Python package
(`ecuador-data`) whose output is a versioned SQLite artifact bundled as a Tauri
resource. Do not embed Python in the desktop runtime.

Versions are pinned by lockfiles and kept inside their major lines. Version
policy fallback: if a planned version cannot be installed on a supported runner,
stay within the same major line, choose the newest compatible patch release,
and record the deviation in the plan Log. Never move to a prerelease major (for
example Tauri 3 alpha) to unblock a task.

## Consequences

- The app uses the OS webview instead of bundling a browser runtime, which keeps
  the installer small, but rendering depends on the platform webview.
- TypeScript and Rust add two toolchains to CI; the three-OS matrix and Tauri
  Linux packages are required.
- The Python pipeline is a build-time dependency only: it can be tested and
  reproduced independently and never ships in the desktop binary.
- The value of this choice (installer size, startup time) must be measured from
  real release artifacts before it is claimed in the README or this ADR.

## Alternatives

- **PySide6**: best language fit for the owner, but charts, theming and polish
  require much bespoke work; installers are large and slower to build on three
  operating systems, and E2E/component tooling is weaker.
- **Flet**: pleasant defaults, but a young ecosystem and harder custom chart and
  accessibility work.
- **Electron**: mature, but bundles a full Chromium per app, the opposite of the
  lightweight native-feel signal this project wants.
- **Tauri + PyInstaller sidecar**: doubles packaging and signing work on every
  platform without improving the user experience.
