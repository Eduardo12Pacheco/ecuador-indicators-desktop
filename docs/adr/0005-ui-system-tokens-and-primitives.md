# ADR 0005 — UI system: CSS tokens and accessible primitives

## Status

Accepted (T7, 2026-11-20).

## Context

The desktop app needs a finished-looking, bilingual, keyboard-first and
WCAG-checked interface without adopting a component framework that would make
it look like a template. The design direction in D9 fixes exact colours,
contrast thresholds, type, spacing, motion and layout values. Those values are
contracts, not suggestions: the plan asks for a test that parses them and fails
when a pair drops below its documented WCAG ratio.

## Decision

- **Tokens in CSS custom properties.** `src/ui/design/tokens.css` is the single
  source for colour, type, spacing, radii, elevation, motion and z-index.
  Light is `:root`; explicit dark is `:root[data-theme="dark"]`; the system
  preference is a `prefers-color-scheme: dark` block constrained to
  `:root:not([data-theme])`. `theme.ts` sets `data-theme` only for explicit
  light/dark, so the OS owns "System".
- **Fonts are vendored.** `npm run fonts:sync` copies the latin variable woff2
  subsets and OFL texts from Fontsource 5.3.0 into `src/ui/design/fonts/`.
  No network request is made for a font (S1).
- **CSS Modules for component styles.** No Tailwind, no runtime CSS-in-JS, no
  duplicate design system. A `*.module.css` declaration keeps classes typed.
- **Radix primitives for the hard accessibility behaviour** (Dialog focus
  trap and focus return, Tabs roving focus, Tooltip, ToggleGroup, Switch,
  Slider) with our own styling. `lucide-react` supplies one-named-import icons.
- **Typed i18n, not i18next.** `en.ts` is the `as const` source of truth; `es.ts`
  is typed as the same shape. A parity test fails on missing keys, empty
  strings or mismatched `{params}`. `Intl.PluralRules` powers `tp`.
- **Tests are contracts.** `tokens.contrast.test.ts` parses the CSS and
  recomputes every D9 ratio; primitive tests cover keyboard behaviour; axe runs
  over the shell and the gallery in both themes.

## Consequences

- A token edit is a tested change, and a failing ratio names the pair.
- The app ships three woff2 files (~125 KB) and no font network dependency.
- New components must reuse primitives; adding a one-off modal or toggle is a
  review defect.
- The gallery route (`#/design`) is built only outside production so the
  production bundle has no design-only entry point.
- The D9 palette did not define a text colour for the accent fill. We added
  `--color-on-accent` (`#15171C` in both themes) because the contrast gate must
  cover text placed on the accent; D9 only recorded the light ratio (10.91).

## Alternatives

- **Tailwind + shadcn/ui:** rejected in D8 (templated look, extra build layer,
  token values would live in config rather than the binding CSS).
- **CSS-in-JS:** rejected (runtime cost, extra dependency, no static parse for
  the contrast contract).
- **i18next:** rejected in D11; the app needs two static dictionaries, not a
  plugin ecosystem.
