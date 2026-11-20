/**
 * Pure series transforms: year-over-year change, indexing to a base year and
 * base-year discovery used by Explore and Compare.
 */

import { appError } from "./errors";
import type { Series, SeriesPoint, Year } from "./model";
import { err, ok, type Result } from "./result";

/**
 * Year-over-year percentage change.
 *
 * A point is emitted only when the immediately previous calendar year exists in
 * the series and its value is non-zero, so gaps stay gaps.
 */
export function yoyChange(series: Series): Series {
  const byYear = new Map<number, number>();
  for (const point of series.points) {
    byYear.set(point.year, point.value);
  }
  const points: SeriesPoint[] = [];
  for (const point of series.points) {
    const previous = byYear.get(point.year - 1);
    if (previous !== undefined && previous !== 0) {
      points.push({ year: point.year, value: (point.value / previous - 1) * 100 });
    }
  }
  return { ...series, points };
}

/**
 * Indexes a series so `baseYear` equals 100.
 *
 * @returns `Err(BASE_YEAR_MISSING)` when the base year has no observation and
 * `Err(BASE_VALUE_ZERO)` when its value is zero.
 */
export function indexToBase(series: Series, baseYear: Year): Result<Series> {
  const base = series.points.find((point) => point.year === baseYear);
  if (base === undefined) {
    return err(appError("BASE_YEAR_MISSING", `base year ${baseYear} is missing from the series`));
  }
  if (base.value === 0) {
    return err(appError("BASE_VALUE_ZERO", `base year ${baseYear} has a zero value`));
  }
  return ok({
    ...series,
    points: series.points.map((point) => ({
      year: point.year,
      value: (point.value / base.value) * 100,
    })),
  });
}

/**
 * Returns the earliest year shared by every series, or `null` when they do not
 * overlap (or the list is empty).
 */
export function commonBaseYear(seriesList: readonly Series[]): Year | null {
  const [first, ...rest] = seriesList;
  if (first === undefined) {
    return null;
  }
  const shared = new Set<number>(first.points.map((point) => point.year));
  for (const series of rest) {
    const years = new Set<number>(series.points.map((point) => point.year));
    for (const candidate of shared) {
      if (!years.has(candidate)) {
        shared.delete(candidate);
      }
    }
  }
  let earliest: number | null = null;
  for (const candidate of shared) {
    if (earliest === null || candidate < earliest) {
      earliest = candidate;
    }
  }
  return earliest === null ? null : (earliest as Year);
}
