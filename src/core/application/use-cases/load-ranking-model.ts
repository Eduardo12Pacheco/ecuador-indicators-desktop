/** Builds the Compare ranking model for one indicator and year. */

import { appError } from "../../domain/errors";
import type { Year } from "../../domain/model";
import { ok, type Result } from "../../domain/result";
import { rankAtYear } from "../../domain/series";
import type { DatasetRepository } from "../ports";
import { loadCatalog } from "./load-catalog";
import { loadSeries, seriesKey } from "./load-series";
import type { RankingModel, RankingRow } from "./models";

/** Inputs for the ranking tab. */
export interface RankingRequest {
  readonly indicator: string;
  readonly year: Year;
}

/**
 * Ranks every geography of the snapshot at the chosen year. Missing values are
 * returned separately so the table can list them last as "No data".
 */
export async function loadRankingModel(
  dataset: DatasetRepository,
  request: RankingRequest,
): Promise<Result<RankingModel>> {
  const yearValidity =
    Number.isInteger(request.year) && request.year >= 1900 && request.year <= 2100;
  if (!yearValidity) {
    return { ok: false, error: appError("INVALID_INPUT", "year must be between 1900 and 2100") };
  }
  const catalog = await loadCatalog(dataset);
  if (!catalog.ok) {
    return catalog;
  }
  const iso3s = catalog.value.geographies.map((geography) => geography.iso3);
  const bundle = await loadSeries(dataset, catalog.value, [request.indicator], iso3s);
  if (!bundle.ok) {
    return bundle;
  }
  const indicator = bundle.value.indicators[0];
  if (indicator === undefined) {
    /* v8 ignore next 3 -- loadSeries guarantees one indicator per requested code */
    return { ok: false, error: appError("INVALID_INPUT", "unknown indicator") };
  }
  const entries = bundle.value.geographies.map((geography) => {
    const series = bundle.value.series.get(seriesKey(indicator.code, geography.iso3));
    return { iso3: geography.iso3, points: series?.points ?? [] };
  });
  const { ranked, missing } = rankAtYear(entries, request.year);
  const byIso3 = new Map(bundle.value.geographies.map((geography) => [geography.iso3, geography]));
  const rankedRows: RankingRow[] = [];
  for (const entry of ranked) {
    const geography = byIso3.get(entry.iso3);
    if (geography !== undefined) {
      rankedRows.push({ geography, value: entry.value });
    }
  }
  const missingGeographies = missing
    .map((code) => byIso3.get(code))
    .filter((geography) => geography !== undefined);
  return ok({ indicator, year: request.year, ranked: rankedRows, missing: missingGeographies });
}
