/** Builds the Explore view model: series, transform and visible range. */

import { appError } from "../../domain/errors";
import type { ChartKind, Series, Transform, Year } from "../../domain/model";
import { ok, type Result } from "../../domain/result";
import { clipRange } from "../../domain/series";
import { commonBaseYear, indexToBase, yoyChange } from "../../domain/transforms";
import type { DatasetRepository } from "../ports";
import { loadCatalog } from "./load-catalog";
import { loadSeries, seriesKey } from "./load-series";
import type { ExploreModel } from "./models";

/** Inputs for the Explore page. */
export interface ExploreRequest {
  readonly indicator: string;
  readonly geographies: readonly string[];
  readonly from: Year | null;
  readonly to: Year | null;
  readonly transform: Transform;
  readonly baseYear: Year | null;
  readonly chart: ChartKind;
}

/**
 * Loads one indicator across the selected geographies, applies the transform
 * and clips to the visible range.
 */
export async function loadExploreModel(
  dataset: DatasetRepository,
  request: ExploreRequest,
): Promise<Result<ExploreModel>> {
  if (request.geographies.length === 0 || request.geographies.length > 5) {
    return { ok: false, error: appError("INVALID_INPUT", "explore needs 1 to 5 geographies") };
  }
  const catalog = await loadCatalog(dataset);
  if (!catalog.ok) {
    return catalog;
  }
  const bundle = await loadSeries(dataset, catalog.value, [request.indicator], request.geographies);
  if (!bundle.ok) {
    return bundle;
  }
  const indicator = bundle.value.indicators[0];
  if (indicator === undefined) {
    /* v8 ignore next 3 -- loadSeries guarantees one indicator per requested code */
    return { ok: false, error: appError("INVALID_INPUT", "unknown indicator") };
  }
  const rawSeries = bundle.value.geographies.map(
    (geography) => bundle.value.series.get(seriesKey(indicator.code, geography.iso3)) as Series,
  );
  let baseYear = request.baseYear;
  if (request.transform === "index" && baseYear === null) {
    baseYear = commonBaseYear(rawSeries);
    if (baseYear === null) {
      return {
        ok: false,
        error: appError("BASE_YEAR_MISSING", "the selected series share no year"),
      };
    }
  }
  const series: Series[] = [];
  for (const raw of rawSeries) {
    const transformed: Result<Series> =
      request.transform === "yoy"
        ? ok(yoyChange(raw))
        : request.transform === "index" && baseYear !== null
          ? indexToBase(raw, baseYear)
          : ok(raw);
    if (!transformed.ok) {
      return transformed;
    }
    const clipped = clipRange(transformed.value, request.from, request.to);
    if (!clipped.ok) {
      return clipped;
    }
    series.push(clipped.value);
  }
  return ok({
    indicator,
    geographies: bundle.value.geographies,
    series,
    transform: request.transform,
    baseYear: request.transform === "index" ? baseYear : null,
    from: request.from,
    to: request.to,
    chart: request.chart,
  });
}
