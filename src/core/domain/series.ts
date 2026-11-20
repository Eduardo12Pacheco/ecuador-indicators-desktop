/**
 * Pure series construction and alignment helpers.
 *
 * Every function is deterministic and free of I/O so it can be property-tested
 * with `fast-check` and reused by every use case.
 */

import { appError } from "./errors";
import type { Geography, Indicator, Iso3, Series, SeriesPoint, Year } from "./model";
import { err, ok, type Result } from "./result";

/** One raw input point before it is validated and branded. */
export interface RawPoint {
  readonly year: number;
  readonly value: number;
}

/**
 * Builds a series sorted ascending by year.
 *
 * @param points - raw annual observations; order does not matter.
 * @returns `Err(DUPLICATE_YEAR)` on a repeated year and `Err(NON_FINITE)` when a
 * value is `NaN` or infinite.
 */
export function makeSeries(
  indicator: Indicator,
  geography: Geography,
  points: readonly RawPoint[],
): Result<Series> {
  const sorted = [...points].sort((left, right) => left.year - right.year);
  const branded: SeriesPoint[] = [];
  for (const [index, point] of sorted.entries()) {
    if (!Number.isFinite(point.value)) {
      return err(
        appError(
          "NON_FINITE",
          `non-finite value for ${indicator.code} ${geography.iso3}`,
          `${point.year}: ${point.value}`,
        ),
      );
    }
    const previous = sorted[index - 1];
    if (previous !== undefined && previous.year === point.year) {
      return err(
        appError(
          "DUPLICATE_YEAR",
          `duplicate year ${point.year} for ${indicator.code} ${geography.iso3}`,
        ),
      );
    }
    branded.push({ year: point.year as Year, value: point.value });
  }
  return ok({ indicator, geography, points: branded });
}

/**
 * Restricts a series to an inclusive year range.
 *
 * @returns `Err(INVALID_INPUT)` when `from > to`; a `null` bound is open.
 */
export function clipRange(series: Series, from: Year | null, to: Year | null): Result<Series> {
  if (from !== null && to !== null && from > to) {
    return err(appError("INVALID_INPUT", `from (${from}) must not be after to (${to})`));
  }
  const points = series.points.filter(
    (point) => (from === null || point.year >= from) && (to === null || point.year <= to),
  );
  return ok({ ...series, points });
}

/** The aligned shape returned by {@link alignSeries}. */
export interface AlignedSeries {
  readonly years: readonly Year[];
  /** One column per input series, aligned to `years`; `null` marks a gap. */
  readonly columns: readonly (number | null)[][];
}

/** Aligns several series over the union of their years. */
export function alignSeries(seriesList: readonly Series[]): AlignedSeries {
  const years = new Set<number>();
  for (const series of seriesList) {
    for (const point of series.points) {
      years.add(point.year);
    }
  }
  const sortedYears = [...years].sort((left, right) => left - right) as Year[];
  const columns = seriesList.map((series) => {
    const values = new Map<number, number>();
    for (const point of series.points) {
      values.set(point.year, point.value);
    }
    return sortedYears.map((year) => values.get(year) ?? null);
  });
  return { years: sortedYears, columns };
}

/** One geography's series considered by a ranking. */
export interface RankEntry {
  readonly iso3: Iso3;
  readonly points: readonly SeriesPoint[];
}

/** A geography with a value at the ranked year. */
export interface RankedEntry {
  readonly iso3: Iso3;
  readonly value: number;
}

/** The result of {@link rankAtYear}. */
export interface RankAtYear {
  readonly ranked: readonly RankedEntry[];
  readonly missing: readonly Iso3[];
}

/**
 * Ranks entries by their value at `year`, descending, with ISO3 as the stable
 * tie-breaker. Entries without an observation are returned in `missing`.
 */
export function rankAtYear(entries: readonly RankEntry[], target: Year): RankAtYear {
  const ranked: RankedEntry[] = [];
  const missing: Iso3[] = [];
  for (const entry of entries) {
    const point = entry.points.find((candidate) => candidate.year === target);
    if (point === undefined) {
      missing.push(entry.iso3);
    } else {
      ranked.push({ iso3: entry.iso3, value: point.value });
    }
  }
  ranked.sort((left, right) =>
    left.value === right.value ? left.iso3.localeCompare(right.iso3) : right.value - left.value,
  );
  missing.sort((left, right) => left.localeCompare(right));
  return { ranked, missing };
}
