/**
 * Stable series styling (D9): a geography always maps to the same palette slot
 * and line/symbol combination, so a chart never relies on color alone. The
 * aggregates share slot 6 but stay distinguishable through their dash pattern.
 */

/** Line dash patterns used by the chart and the legend. */
export type LineType = "solid" | "dashed" | "dotted" | "dash-dot";

/** Marker shapes used at data points. */
export type SeriesSymbol = "circle" | "square" | "triangle" | "diamond" | "pin" | "rect";

/** A resolved visual style for one series slot. */
export interface SeriesStyle {
  /** 1-based palette slot (`--series-1` .. `--series-6`). */
  readonly slot: number;
  /** CSS custom property holding the series color. */
  readonly colorToken: `--series-${number}`;
  readonly lineType: LineType;
  readonly symbol: SeriesSymbol;
}

/** Geography to palette slot mapping fixed by D9. */
export const GEOGRAPHY_SLOTS: Readonly<Record<string, number>> = {
  ECU: 1,
  COL: 2,
  PER: 3,
  CHL: 4,
  BOL: 5,
  LCN: 6,
  WLD: 6,
};

const SLOT_STYLES: Readonly<
  Record<number, { readonly lineType: LineType; readonly symbol: SeriesSymbol }>
> = {
  1: { lineType: "solid", symbol: "circle" },
  2: { lineType: "dashed", symbol: "square" },
  3: { lineType: "dotted", symbol: "triangle" },
  4: { lineType: "dash-dot", symbol: "diamond" },
  5: { lineType: "solid", symbol: "pin" },
  6: { lineType: "dashed", symbol: "rect" },
};

/** Fallback style when an unknown slot is requested. */
const DEFAULT_STYLE: { readonly lineType: LineType; readonly symbol: SeriesSymbol } = {
  lineType: "solid",
  symbol: "circle",
};

/** Returns the 1-based slot assigned to a geography. */
export function geographySlot(iso3: string): number {
  return GEOGRAPHY_SLOTS[iso3] ?? 0;
}

/** True for the two aggregate geographies that share slot 6. */
export function isAggregateGeography(iso3: string): boolean {
  return iso3 === "LCN" || iso3 === "WLD";
}

/**
 * Resolves the style for a geography.
 *
 * `fallbackIndex` is the series position; it is only used for geographies the
 * snapshot does not know, so the mapping stays stable for the seven bundled
 * geographies. Aggregates always get their documented dash pattern.
 */
export function styleForGeography(iso3: string, fallbackIndex = 0): SeriesStyle {
  const assigned = geographySlot(iso3);
  const slot = assigned > 0 ? assigned : (fallbackIndex % 6) + 1;
  const base = SLOT_STYLES[slot] ?? DEFAULT_STYLE;
  let lineType = base.lineType;
  if (iso3 === "LCN") lineType = "dashed";
  if (iso3 === "WLD") lineType = "dotted";
  return {
    slot,
    colorToken: `--series-${slot}`,
    lineType,
    symbol: base.symbol,
  };
}

/** Resolves the style for a 1-based slot, used by Trajectories selection order. */
export function styleForSlot(slot: number): SeriesStyle {
  const normalized = ((((slot - 1) % 6) + 6) % 6) + 1;
  const base = SLOT_STYLES[normalized] ?? DEFAULT_STYLE;
  return {
    slot: normalized,
    colorToken: `--series-${normalized}`,
    lineType: base.lineType,
    symbol: base.symbol,
  };
}

/** ECharts `lineStyle.type` value for a domain line type. */
export function echartsLineType(lineType: LineType): "solid" | "dashed" | "dotted" | number[] {
  if (lineType === "dash-dot") {
    return [8, 4, 2, 4];
  }
  return lineType;
}
