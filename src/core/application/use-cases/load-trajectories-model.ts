/** Builds the Compare trajectories model: 2 to 4 indicators indexed to a base year. */

import { appError } from "../../domain/errors";
import type { IndicatorCode, Iso3, Series, Year } from "../../domain/model";
import { ok, type Result } from "../../domain/result";
import { commonBaseYear, indexToBase } from "../../domain/transforms";
import { validateViewSpec } from "../../domain/view";
import type { DatasetRepository } from "../ports";
import { loadCatalog } from "./load-catalog";
import { loadSeries, seriesKey } from "./load-series";
import type { TrajectoriesModel } from "./models";

/** Inputs for the trajectories tab. */
export interface TrajectoriesRequest {
  readonly indicators: readonly string[];
  readonly geography: Iso3;
  readonly baseYear: Year | null;
}

/**
 * Loads 2 to 4 indicators for one geography and indexes them to the requested
 * base year, defaulting to the first year all series share.
 */
export async function loadTrajectoriesModel(
  dataset: DatasetRepository,
  request: TrajectoriesRequest,
): Promise<Result<TrajectoriesModel>> {
  const validity = validateViewSpec({
    kind: "trajectories",
    indicators: request.indicators.map((code) => code as IndicatorCode),
    geography: request.geography,
    baseYear: request.baseYear,
  });
  if (!validity.ok) {
    return validity;
  }
  const catalog = await loadCatalog(dataset);
  if (!catalog.ok) {
    return catalog;
  }
  const bundle = await loadSeries(dataset, catalog.value, request.indicators, [request.geography]);
  if (!bundle.ok) {
    return bundle;
  }
  const geography = bundle.value.geographies[0];
  if (geography === undefined) {
    /* v8 ignore next 3 -- loadSeries guarantees one geography per requested code */
    return { ok: false, error: appError("INVALID_INPUT", "unknown geography") };
  }
  const rawSeries = bundle.value.indicators.map(
    (indicator) => bundle.value.series.get(seriesKey(indicator.code, geography.iso3)) as Series,
  );
  const baseYear = request.baseYear ?? commonBaseYear(rawSeries);
  if (baseYear === null) {
    return ok({ indicators: bundle.value.indicators, geography, baseYear: null, series: [] });
  }
  const series: Series[] = [];
  for (const raw of rawSeries) {
    const indexed = indexToBase(raw, baseYear);
    if (!indexed.ok) {
      return indexed;
    }
    series.push(indexed.value);
  }
  return ok({ indicators: bundle.value.indicators, geography, baseYear, series });
}
