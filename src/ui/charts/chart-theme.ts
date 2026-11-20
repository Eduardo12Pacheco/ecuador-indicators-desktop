/**
 * Chart colours resolved from the design tokens at render time (D9).
 *
 * ECharts paints on a canvas and cannot resolve CSS custom properties itself,
 * so the option builder receives a plain object read from `tokens.css`. When a
 * token is unavailable (tests, first paint) the documented fallback palette of
 * the matching theme is used instead of a transparent canvas.
 */

/** Palette and typography needed to paint a chart. */
export interface ChartTheme {
  readonly background: string;
  readonly surface: string;
  readonly text: string;
  readonly textMuted: string;
  readonly border: string;
  readonly borderStrong: string;
  readonly primary: string;
  readonly series: readonly [string, string, string, string, string, string];
  readonly fontUi: string;
  readonly fontMono: string;
}

/** Light fallbacks copied from D9 for non-DOM renderers. */
export const FALLBACK_LIGHT: ChartTheme = {
  background: "#f6f4ee",
  surface: "#ffffff",
  text: "#15171c",
  textMuted: "#555b68",
  border: "#d6d2c6",
  borderStrong: "#7d7a70",
  primary: "#1b47c4",
  series: ["#1b47c4", "#c2410c", "#0f766e", "#9d2eb0", "#7a5c00", "#5a6272"],
  fontUi: "Inter Variable, system-ui, sans-serif",
  fontMono: "JetBrains Mono Variable, ui-monospace, monospace",
};

/** Dark fallbacks copied from D9. */
export const FALLBACK_DARK: ChartTheme = {
  background: "#0e1116",
  surface: "#161a21",
  text: "#edeff3",
  textMuted: "#a0a7b5",
  border: "#2b313c",
  borderStrong: "#6e7788",
  primary: "#8faaff",
  series: ["#8faaff", "#fb923c", "#2dd4bf", "#e27bf2", "#f2c94c", "#a9b1c0"],
  fontUi: "Inter Variable, system-ui, sans-serif",
  fontMono: "JetBrains Mono Variable, ui-monospace, monospace",
};

/** True when the document currently resolves to the dark palette. */
export function isDarkDocument(root: HTMLElement | null): boolean {
  if (root === null) {
    return false;
  }
  if (root.dataset.theme === "dark") {
    return true;
  }
  if (root.dataset.theme === "light") {
    return false;
  }
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/**
 * Reads the chart palette from the document's design tokens.
 *
 * @param root - element carrying the tokens (defaults to `<html>`).
 */
export function readChartTheme(
  root: HTMLElement | null = typeof document === "undefined" ? null : document.documentElement,
): ChartTheme {
  const fallback = isDarkDocument(root) ? FALLBACK_DARK : FALLBACK_LIGHT;
  if (root === null || typeof getComputedStyle !== "function") {
    return fallback;
  }
  const styles = getComputedStyle(root);
  const read = (name: string, value: string): string => {
    const resolved = styles.getPropertyValue(name).trim();
    return resolved === "" ? value : resolved;
  };
  return {
    background: read("--color-bg", fallback.background),
    surface: read("--color-surface", fallback.surface),
    text: read("--color-text", fallback.text),
    textMuted: read("--color-text-muted", fallback.textMuted),
    border: read("--color-border", fallback.border),
    borderStrong: read("--color-border-strong", fallback.borderStrong),
    primary: read("--color-primary", fallback.primary),
    series: [
      read("--series-1", fallback.series[0]),
      read("--series-2", fallback.series[1]),
      read("--series-3", fallback.series[2]),
      read("--series-4", fallback.series[3]),
      read("--series-5", fallback.series[4]),
      read("--series-6", fallback.series[5]),
    ],
    fontUi: read("--font-ui", fallback.fontUi),
    fontMono: read("--font-mono", fallback.fontMono),
  };
}

/**
 * Resolves the chart palette for a resolved UI theme.
 *
 * The theme provider applies `data-theme` in an effect, so on the render that
 * flips the preference the document may still carry the previous palette. In
 * that case the documented fallback for the requested theme is used; once the
 * DOM matches, any customized token values win.
 */
export function chartThemeFor(
  resolved: "light" | "dark",
  root: HTMLElement | null = typeof document === "undefined" ? null : document.documentElement,
): ChartTheme {
  const expectedDark = resolved === "dark";
  if (isDarkDocument(root) === expectedDark) {
    return readChartTheme(root);
  }
  return expectedDark ? FALLBACK_DARK : FALLBACK_LIGHT;
}

/** Returns the palette color for a 1-based series slot. */
export function themeSeriesColor(theme: ChartTheme, slot: number): string {
  return theme.series[slot - 1] ?? theme.series[0];
}
