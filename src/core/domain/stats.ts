/**
 * Summary statistics over a single series. All values are derived from the
 * visible points; no smoothing or forecasting is applied.
 */

import type { Series, SeriesPoint, Year } from "./model";

/** Compound annual growth rate between the first and last points, in percent. */
export interface Cagr {
  readonly value: number;
}

/** A year/value pair used by the summary. */
export interface YearValue {
  readonly year: Year;
  readonly value: number;
}

/** The absolute and relative change against the previous observation. */
export interface SeriesChange {
  readonly abs: number;
  readonly pct: number | null;
}

/** The KPI summary rendered above an Explore chart. */
export interface SeriesSummary {
  readonly count: number;
  readonly firstYear: Year;
  readonly lastYear: Year;
  readonly latest: YearValue;
  readonly previous: YearValue | null;
  readonly change: SeriesChange | null;
  readonly min: YearValue;
  readonly max: YearValue;
  readonly cagr: number | null;
}

/**
 * Compound annual growth rate in percent.
 *
 * Returns `null` unless both endpoints are positive and the years differ.
 */
export function cagr(series: Series): number | null {
  const points = series.points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  if (first.value <= 0 || last.value <= 0 || first.year === last.year) {
    return null;
  }
  return ((last.value / first.value) ** (1 / (last.year - first.year)) - 1) * 100;
}

/** Summarizes a series, or returns `null` for an empty series. */
export function summarize(series: Series): SeriesSummary | null {
  const points = series.points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) {
    return null;
  }
  let min: SeriesPoint = first;
  let max: SeriesPoint = first;
  for (const point of points) {
    if (point.value < min.value) {
      min = point;
    }
    if (point.value > max.value) {
      max = point;
    }
  }
  const previous = points[points.length - 2] ?? null;
  const change =
    previous === null
      ? null
      : {
          abs: last.value - previous.value,
          pct: previous.value === 0 ? null : ((last.value - previous.value) / previous.value) * 100,
        };
  return {
    count: points.length,
    firstYear: first.year,
    lastYear: last.year,
    latest: { year: last.year, value: last.value },
    previous: previous === null ? null : { year: previous.year, value: previous.value },
    change,
    min: { year: min.year, value: min.value },
    max: { year: max.year, value: max.value },
    cagr: cagr(series),
  };
}
