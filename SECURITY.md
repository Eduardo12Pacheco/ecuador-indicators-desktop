# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub Security Advisories on
this repository. Do not open a public issue for an unfixed vulnerability.

## Supported versions

Security fixes are applied to the latest release on the `main` branch.

## Posture

- The application is local-first: no accounts, no telemetry and no remote
  service beyond the optional, notify-only update check.
- Snapshot databases are opened read-only, and export paths are restricted to
  `.csv` and `.png` files written atomically.
- The Tauri capability set is minimal: no filesystem, shell or HTTP plugin.
- Bundled data comes from the World Bank World Development Indicators (CC BY
  4.0); see `THIRD_PARTY_NOTICES.md` once data is bundled.
