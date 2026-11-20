/**
 * Shared series loader: validates requested indicators/geographies against the
 * catalog and groups observations into one series per pair.
 */

import { appError } from "../../domain/errors";
import {
  type Catalog,
  findGeography,
  findIndicator,
  type Geography,
  type Indicator,
  type Observation,
  type Series,
} from "../../domain/model";
import { err, ok, type Result } from "../../domain/result";
import { makeSeries } from "../../domain/series";

/** The validated inputs and resulting series for one load. */
export interface SeriesBundle {
  readonly indicators: readonly Indicator[];
  readonly geographies: readonly Geography[];
  readonly observations: readonly Observation[];
  readonly series: ReadonlyMap<string, Series>;
}

/** Stable map key for an indicator/geography pair. */
export function seriesKey(code: string, geography: string): string {
  return `${code}\u0000${geography}`;
}

/** Loads and validates the series for the requested codes and ISO3s. */
export async function loadSeries(
  dataset: {
    getObservations: (codes: string[], iso3s: string[]) => Promise<Result<readonly Observation[]>>;
  },
  catalog: Catalog,
  codes: readonly string[],
  iso3s: readonly string[],
): Promise<Result<SeriesBundle>> {
  const indicators: Indicator[] = [];
  for (const code of codes) {
    const indicator = findIndicator(catalog, code);
    if (indicator === undefined) {
      return err(appError("INVALID_INPUT", `unknown indicator ${code}`));
    }
    indicators.push(indicator);
  }
  const geographies: Geography[] = [];
  for (const code of iso3s) {
    const geography = findGeography(catalog, code);
    if (geography === undefined) {
      return err(appError("INVALID_INPUT", `unknown geography ${code}`));
    }
    geographies.push(geography);
  }
  const observations = await dataset.getObservations([...codes], [...iso3s]);
  if (!observations.ok) {
    return observations;
  }
  const grouped = new Map<string, { year: number; value: number }[]>();
  for (const observation of observations.value) {
    const key = seriesKey(observation.indicatorCode, observation.iso3);
    const bucket = grouped.get(key);
    if (bucket === undefined) {
      grouped.set(key, [{ year: observation.year, value: observation.value }]);
    } else {
      bucket.push({ year: observation.year, value: observation.value });
    }
  }
  const series = new Map<string, Series>();
  for (const indicator of indicators) {
    for (const geography of geographies) {
      const key = seriesKey(indicator.code, geography.iso3);
      const built = makeSeries(indicator, geography, grouped.get(key) ?? []);
      if (!built.ok) {
        return built;
      }
      series.set(key, built.value);
    }
  }
  return ok({ indicators, geographies, observations: observations.value, series });
}
