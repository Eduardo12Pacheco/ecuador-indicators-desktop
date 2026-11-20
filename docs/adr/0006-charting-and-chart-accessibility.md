# ADR 0006 — Charting and chart accessibility

## Status

Accepted (T8, 2026-11-20).

## Context

Explore needs one indicator across up to five geographies, three chart types
(line, area, bar), level/YoY/index transforms, gap-aware series and a PNG
export that includes a title, legend and World Bank attribution (S3, S7, S11).
Charts are canvas-rendered, so they are invisible to screen readers unless the
application supplies an accessible alternative and keyboard interaction. The
plan rejects a visual-regression suite (cross-OS font rasterization) and asks
for component tests against a fake renderer instead.

## Decision

- **ECharts 6, tree-shaken.** Only `LineChart`, `BarChart`, `Grid`, `Tooltip`,
  `Legend`, `Aria`, `Title`, `Graphic` and `CanvasRenderer` are registered, and
  imports use `echarts/core` subpaths (never the `echarts` root). The
  architecture test allows `echarts` in `src/ui` only; the core never sees it.
- **A `ChartRenderer` port.** `renderer.ts` defines
  `setOption/showTip/hideTip/toDataURL/resize/dispose`; `echarts-renderer.ts`
  implements it with a `ResizeObserver` and a DPR-aware canvas. Components take
  an injected factory, so tests use `FakeChartRenderer` and never need a canvas
  implementation.
- **Pure option builders.** `build-chart-option.ts` takes the explore model, a
  resolved `ChartTheme` and a locale, and returns the option object. Export mode
  adds the title, legend and attribution footer. `chart-theme.ts` reads the
  design tokens from the document and falls back to the D9 palettes when the
  custom properties are unavailable (tests, headless capture).
- **Stable series styling.** `series-style.ts` fixes the geography-to-slot map
  (ECU=1 … BOL=5, LCN/WLD share slot 6 with dashed/dotted lines), plus a symbol
  per slot. Series never rely on colour alone.
- **Keyboard scrubbing.** `use-chart-keyboard.ts` moves a cursor over the years
  that have data in the first series: Left/Right step, Home/End jump, Escape
  clears. It dispatches `showTip` and returns the polite announcement
  `{geography}, {year}: {value}`. `ChartCanvas` renders that region, makes the
  chart a focusable `role="group"` with a computed summary and keeps the canvas
  `aria-hidden`.
- **A data-table alternative on the same page.** `DataTable` aligns all series
  over the year union, puts Ecuador first, uses `scope` attributes and renders a
  visually hidden "No data" for gaps.
- **PNG export through the same builder.** `export-png.ts` rebuilds the option
  in export mode, asks the renderer for a 2x data URL and converts it to bytes;
  T10 wires the native save dialog. The builder, not the renderer, owns the
  title/attribution contract.

## Consequences

- Chart logic (series order, colors, gaps, transforms, export metadata) is
  covered by fast unit tests; only the thin ECharts adapter needs a DOM.
- The bundle grows by roughly 200 KB raw (~95 KB gzip for the lazy dashboard
  chunk), still within the 700 KiB gzip budget. The production chunk is
  tree-shaken by construction; importing the ECharts root would be a review
  defect.
- The chart is duplicated information by design: canvas plus live region plus
  table. The table is always reachable through the view toggle.
- PNG export is a chart screenshot at 2x with data labels and attribution; it is
  not a print-quality typeset document.

## Alternatives

- **uPlot:** smaller, but no accessible tooltip/ARIA story and no export helper.
- **Observable Plot:** weak interaction and no legend/tooltip control at this
  level of detail.
- **Recharts:** an SVG React tree is heavier for multi-series charts and gives
  less control over the canvas export and keyboard scrubbing.
- **Server-side rendering to PNG:** would add a heavy native dependency to a
  desktop app that must build on three operating systems.
