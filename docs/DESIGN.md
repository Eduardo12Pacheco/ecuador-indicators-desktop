# Design system

The interface direction is an **editorial data journal**: warm paper in light
mode, ink-blue in dark mode, Fraunces only for page titles and the wordmark,
Inter for everything else and JetBrains Mono for codes. Ecuador's flag yellow
appears only as a small accent mark, never as text or a chart series.

Binding values live in `src/ui/design/tokens.css`; the contrast contract is
enforced by `src/ui/design/tokens.contrast.test.ts` (S10). This document is the
human-readable companion; T15 completes it with screenshots and the final
shortcut table.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-bg` | `#F6F4EE` | `#0E1116` | App background |
| `--color-surface` | `#FFFFFF` | `#161A21` | Cards, dialogs, bars |
| `--color-surface-2` | `#EEEBE3` | `#1E232C` | Subtle fills, active nav |
| `--color-border` | `#D6D2C6` | `#2B313C` | Decorative dividers only |
| `--color-border-strong` | `#7D7A70` | `#6E7788` | Control borders (≥ 3:1) |
| `--color-text` | `#15171C` | `#EDEFF3` | Body text |
| `--color-text-muted` | `#555B68` | `#A0A7B5` | Secondary text |
| `--color-primary` | `#1B47C4` | `#8FAAFF` | Primary actions, links |
| `--color-primary-hover` | `#13399F` | `#B0C2FF` | Hover |
| `--color-on-primary` | `#FFFFFF` | `#0B1020` | Text on primary |
| `--color-danger` | `#B3261E` | `#FF8A80` | Errors, destructive |
| `--color-success` | `#17692F` | `#6FD28A` | Success |
| `--color-warning` | `#8A5300` | `#F0B04A` | Warnings |
| `--color-accent` | `#F5C400` | `#FFD23F` | Ecuadorean accent mark |
| `--color-on-accent` | `#15171C` | `#15171C` | Text on accent |
| `--focus-ring` | `#1B47C4` | `#8FAAFF` | Focus outline |

Series slots `--series-1..6` are stable per geography: ECU=1, COL=2, PER=3,
CHL=4, BOL=5, LCN=6 dashed, WLD=6 dotted. Line style and symbols also differ, so
colour is never the only channel.

### Contrast gate

The Vitest contract recomputes the WCAG 2.x relative-luminance ratios and fails
below: text and muted text on bg/surface/surface-2 ≥ 4.5; on-primary on primary
≥ 4.5; primary, danger, success and warning as text on surface ≥ 4.5;
border-strong on surface and bg ≥ 3; every series colour on surface and bg ≥ 3;
text on accent ≥ 4.5. Decorative `--color-border` is exempt (it never carries
meaning).

## Type

16 px root, 14 px UI base. Caption 12/16, small 13/18, body 14/20, body-lg
16/24, h3 18/26 Inter 600, h2 22/30 Fraunces 600, h1 28/36 Fraunces 600, KPI
32/36 Inter 650 with tabular numerals. Letter spacing is 0 except h1/h2
`-0.01em`. Font stacks and the three vendored OFL subsets are defined in
`fonts.css`.

## Spacing, radii, elevation, motion, layers

- Spacing is a 4 px scale from `--space-0` (0) to `--space-11` (64 px); content
  padding is `--space-7` (24 px).
- Radii: 4 / 8 / 12 px and a 999 px pill.
- Elevation: three shadows; the dark theme keeps the offsets and raises alpha
  to 0.4 / 0.5 / 0.6.
- Motion: 120 / 200 / 320 ms with `cubic-bezier(0.2, 0, 0, 1)`; under
  `prefers-reduced-motion: reduce` every duration resolves to 0.01 ms.
- Layers: base 0, sticky 10, popover 30, dialog 40, toast 50, palette 60.
- Layout: sidebar 232 px (64 px collapsed below 1100 px or via the toggle), top
  bar 56 px, status bar 28 px, minimum hit target 32 px, focus ring 2 px with
  2 px offset.

## Accessibility rules

- Every flow is keyboard-completable. The skip link is the first focusable
  element and moves focus to `main`; focus is always visible (`:focus-visible`).
- Landmarks: `banner` (top bar), `navigation` (labelled), `main#main`,
  `contentinfo` (status bar); the active route carries `aria-current="page"`
  plus a non-colour accent marker.
- Controls use Radix semantics: Dialog traps focus, closes on Escape and
  returns focus to its trigger; Tabs and ToggleGroup support arrow keys; Switch
  toggles with Space; Slider thumbs are labelled.
- Icon-only controls require a `label` prop and render `aria-label`.
- Toasts live in a polite `role="status"` region, pause on hover/focus and can
  be dismissed with a labelled button.
- Charts (T8) are focusable, scrubbable with arrows/Home/End/Escape and have a
  data-table alternative; this task owns the shell and primitives only.
- Axe scans the shell and the design gallery in both themes in Vitest; T11
  repeats them in a real browser for contrast and layout.

## Shortcuts

The command registry and the final shortcut table arrive in T9; the D26 map is
the binding contract: `Mod+K` palette, `?` help, `g` then `e|c|v|s`, `[`/`]`
previous/next indicator, `Mod+S` save view, `Mod+Shift+C` CSV, `Mod+Shift+P`
PNG, `Mod+Shift+D` toggle theme.

## Development

- `npm run fonts:sync` reproduces `src/ui/design/fonts/`.
- `npx vitest run src/ui/design` runs the contrast, theme, i18n and primitive
  contracts.
- `#/design` shows the gallery in development and end-to-end builds, not in the
  production bundle.
