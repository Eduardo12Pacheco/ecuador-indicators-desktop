/**
 * Explore page state as URL search parameters (S3, D7).
 *
 * Parsing is total and sanitizing: an unknown indicator falls back to the
 * default, unknown geographies are dropped, Ecuador is forced first, swapped
 * ranges are swapped back and a base year outside the range is cleared.
 */

import {
  type Catalog,
  type ChartKind,
  type Iso3,
  indicatorCode,
  isIso3,
  isYear,
  type Transform,
  type Year,
} from "./model";

/** Minimal read surface shared by `URLSearchParams` and test doubles. */
export interface QueryParams {
  get(name: string): string | null;
}

/** Default indicator shown when no route/query selects one. */
export const DEFAULT_INDICATOR = indicatorCode("NY.GDP.MKTP.CD");
/** Ecuador is always the first Explore geography. */
export const DEFAULT_GEOGRAPHY = "ECU";

/** The normalized Explore page state. */
export interface ExploreState {
  readonly indicator: ReturnType<typeof indicatorCode>;
  readonly geographies: readonly Iso3[];
  readonly from: Year | null;
  readonly to: Year | null;
  readonly transform: Transform;
  readonly baseYear: Year | null;
  readonly chart: ChartKind;
}

function parseYear(raw: string | null): Year | null {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return isYear(value) ? value : null;
}

function fallbackIndicator(catalog: Catalog) {
  if (catalog.indicators.some((indicator) => indicator.code === DEFAULT_INDICATOR)) {
    return DEFAULT_INDICATOR;
  }
  const first = catalog.indicators[0];
  return first === undefined ? DEFAULT_INDICATOR : indicatorCode(first.code);
}

function sanitizeGeographies(raw: string | null, catalog: Catalog): Iso3[] {
  const known = new Set(catalog.geographies.map((geography) => geography.iso3));
  const requested = (raw ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => isIso3(value) && known.has(value));
  const unique = [...new Set(requested)].filter((value) => value !== DEFAULT_GEOGRAPHY) as Iso3[];
  const fallback = catalog.geographies[0]?.iso3 ?? DEFAULT_GEOGRAPHY;
  const first =
    known.has(DEFAULT_GEOGRAPHY as Iso3) || unique.length === 0
      ? (DEFAULT_GEOGRAPHY as Iso3)
      : (unique.shift() ?? (fallback as Iso3));
  return [first, ...unique].slice(0, 5) as Iso3[];
}

/**
 * Parses and sanitizes Explore state from URL search parameters.
 *
 * The indicator is accepted under `i` (the route owns the canonical path, the
 * hook mirrors it into `i` so the state is self-contained).
 */
export function parseExploreState(params: QueryParams, catalog: Catalog): ExploreState {
  const requested = params.get("i");
  const indicator =
    requested !== null && catalog.indicators.some((candidate) => candidate.code === requested)
      ? indicatorCode(requested)
      : fallbackIndicator(catalog);

  const geographies = sanitizeGeographies(params.get("g"), catalog);

  const rawFrom = parseYear(params.get("from"));
  const rawTo = parseYear(params.get("to"));
  const swapped = rawFrom !== null && rawTo !== null && rawFrom > rawTo;
  const from = swapped ? rawTo : rawFrom;
  const to = swapped ? rawFrom : rawTo;

  const rawTransform = params.get("t");
  const transform: Transform =
    rawTransform === "yoy" || rawTransform === "index" ? rawTransform : "level";

  let base = parseYear(params.get("base"));
  if (base !== null && from !== null && to !== null && (base < from || base > to)) {
    base = null;
  }

  const rawChart = params.get("ch");
  const chart: ChartKind = rawChart === "area" || rawChart === "bar" ? rawChart : "line";

  return { indicator, geographies, from, to, transform, baseYear: base, chart };
}

/**
 * Serializes Explore state back to a query string with defaults omitted.
 *
 * The output is deterministic (fixed key order) and never starts with `?`.
 */
export function serializeExploreState(state: ExploreState): string {
  const parts: string[] = [];
  if (state.indicator !== DEFAULT_INDICATOR) {
    parts.push(`i=${encodeURIComponent(state.indicator)}`);
  }
  const geographies = state.geographies.join(",");
  if (geographies !== DEFAULT_GEOGRAPHY) {
    parts.push(`g=${encodeURIComponent(geographies)}`);
  }
  if (state.from !== null) {
    parts.push(`from=${state.from}`);
  }
  if (state.to !== null) {
    parts.push(`to=${state.to}`);
  }
  if (state.transform !== "level") {
    parts.push(`t=${state.transform}`);
  }
  if (state.baseYear !== null) {
    parts.push(`base=${state.baseYear}`);
  }
  if (state.chart !== "line") {
    parts.push(`ch=${state.chart}`);
  }
  return parts.join("&");
}
