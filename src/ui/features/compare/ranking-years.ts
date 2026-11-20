/**
 * Ranking year options derived from the observations of every geography (S4).
 *
 * The select lists years with data; the default is the latest year where at
 * least five geographies have a value, falling back to the latest year with any
 * data on sparse indicators.
 */

import type { Observation, Year } from "../../../core/domain/model";

/** Available ranking years plus the rule-driven default. */
export interface RankingYearOptions {
  readonly years: readonly Year[];
  readonly defaultYear: Year | null;
}

/** Minimum geographies for the preferred default year. */
export const RANKING_MIN_GEOGRAPHIES = 5;

/** Computes the selectable years and the default year for one indicator. */
export function rankingYearOptions(observations: readonly Observation[]): RankingYearOptions {
  const geographiesByYear = new Map<number, Set<string>>();
  for (const observation of observations) {
    const bucket = geographiesByYear.get(observation.year);
    if (bucket === undefined) {
      geographiesByYear.set(observation.year, new Set([observation.iso3]));
    } else {
      bucket.add(observation.iso3);
    }
  }
  const years = [...geographiesByYear.keys()].sort((left, right) => left - right) as Year[];
  if (years.length === 0) {
    return { years, defaultYear: null };
  }
  let preferred: Year | null = null;
  for (const candidate of years) {
    const count = geographiesByYear.get(candidate)?.size ?? 0;
    if (count >= RANKING_MIN_GEOGRAPHIES) {
      preferred = candidate;
    }
  }
  return { years, defaultYear: preferred ?? years[years.length - 1] ?? null };
}
