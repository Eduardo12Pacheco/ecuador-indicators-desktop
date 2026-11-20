/** Builds an RFC 4180 CSV of the visible Explore series and hands it to the host. */

import { buildExportRows, toCsv } from "../../domain/csv";
import { appError } from "../../domain/errors";
import type { Iso3, Lang, Year } from "../../domain/model";
import { ok, type Result } from "../../domain/result";
import type { DatasetRepository, ExportGateway } from "../ports";
import { loadExploreModel } from "./load-explore-model";

/** The visible page state needed for a CSV export. */
export interface ExportCsvRequest {
  readonly indicator: string;
  readonly geographies: readonly Iso3[];
  readonly from: Year | null;
  readonly to: Year | null;
  readonly lang: Lang;
}

/** Dependencies for {@link exportCsv}. */
export interface ExportCsvDeps {
  readonly dataset: DatasetRepository;
  readonly export: ExportGateway;
}

/**
 * Exports the visible, untransformed observations in long format.
 *
 * @returns The saved path (native) or the download marker (web).
 */
export async function exportCsv(
  deps: ExportCsvDeps,
  request: ExportCsvRequest,
): Promise<Result<string>> {
  const model = await loadExploreModel(deps.dataset, {
    indicator: request.indicator,
    geographies: request.geographies,
    from: request.from,
    to: request.to,
    transform: "level",
    baseYear: null,
    chart: "line",
  });
  if (!model.ok) {
    return model;
  }
  const allYears = model.value.series.flatMap((series) => series.points.map((point) => point.year));
  if (allYears.length === 0) {
    return { ok: false, error: appError("INVALID_INPUT", "there is nothing visible to export") };
  }
  const from = request.from ?? Math.min(...allYears);
  const to = request.to ?? Math.max(...allYears);
  const content = toCsv(
    buildExportRows({
      indicator: model.value.indicator,
      geographies: model.value.geographies,
      series: model.value.series,
      lang: request.lang,
    }),
  );
  const saved = await deps.export.save({
    suggestedName: `ecuador-${model.value.indicator.code}-${from}-${to}.csv`,
    kind: "csv",
    content,
  });
  return saved.ok ? ok(saved.value) : saved;
}
