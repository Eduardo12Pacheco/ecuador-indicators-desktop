/**
 * Export use case wiring for the Explore page (S7).
 *
 * CSV goes through the shared `exportCsv` use case so it serializes exactly
 * the visible series and range. PNG rebuilds the chart in export mode through
 * the live renderer at 2x pixel ratio.
 */

import { useCallback, useState } from "react";
import { DOWNLOAD_STARTED, SAVE_CANCELLED } from "../../../core/application/ports";
import { exportCsv as exportCsvRows } from "../../../core/application/use-cases/export-csv";
import type { ExploreModel } from "../../../core/application/use-cases/models";
import type { Lang } from "../../../core/domain/model";
import type { Result } from "../../../core/domain/result";
import type { ChartTheme } from "../../charts/chart-theme";
import { chartPngDataUrl, dataUrlToBytes } from "../../charts/export-png";
import type { ChartRenderer } from "../../charts/renderer";
import { useToast } from "../../design/primitives/Toast/Toast";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import type { FileExportKind } from "./export-context";

/** Inputs for {@link useExport}. */
export interface UseExportOptions {
  readonly model: ExploreModel | null;
  readonly renderer: ChartRenderer | null;
  readonly theme: ChartTheme;
  readonly locale: string;
  readonly lang: Lang;
}

/** Export handlers, availability and the in-flight kind. */
export interface ExportController {
  readonly exportCsv: () => Promise<void>;
  readonly exportPng: () => Promise<void>;
  readonly available: Readonly<Record<FileExportKind, boolean>>;
  readonly busy: FileExportKind | null;
}

function trimmedName(model: ExploreModel, extension: FileExportKind): string {
  const years = model.series.flatMap((series) => series.points.map((point) => point.year));
  const from = model.from ?? (years.length === 0 ? "" : Math.min(...years));
  const to = model.to ?? (years.length === 0 ? "" : Math.max(...years));
  return `ecuador-${model.indicator.code}-${from}-${to}.${extension}`;
}

/** Builds the export handlers for one Explore model. */
export function useExport({
  model,
  renderer,
  theme,
  locale,
  lang,
}: UseExportOptions): ExportController {
  const ports = usePorts();
  const { t } = useT();
  const { showToast } = useToast();
  const [busy, setBusy] = useState<FileExportKind | null>(null);

  const report = useCallback(
    (result: Result<string>) => {
      if (!result.ok) {
        showToast({
          title: t("export.failed"),
          description: `${result.error.code}: ${result.error.message}`,
          variant: "danger",
        });
        return;
      }
      if (result.value === SAVE_CANCELLED) {
        return;
      }
      showToast({
        title:
          result.value === DOWNLOAD_STARTED
            ? t("export.downloadStarted")
            : t("export.saved", { path: result.value }),
        variant: "success",
      });
    },
    [showToast, t],
  );

  const exportCsv = useCallback(async () => {
    if (model === null || busy !== null) {
      return;
    }
    setBusy("csv");
    const result = await exportCsvRows(ports, {
      indicator: model.indicator.code,
      geographies: model.geographies.map((geography) => geography.iso3),
      from: model.from,
      to: model.to,
      lang,
    });
    setBusy(null);
    report(result);
  }, [busy, lang, model, ports, report]);

  const exportPng = useCallback(async () => {
    if (model === null || renderer === null || busy !== null) {
      return;
    }
    setBusy("png");
    try {
      const dataUrl = chartPngDataUrl(renderer, model, theme, locale);
      const result = await ports.export.save({
        suggestedName: trimmedName(model, "png"),
        kind: "png",
        content: dataUrlToBytes(dataUrl),
      });
      setBusy(null);
      report(result);
    } catch (error) {
      setBusy(null);
      report({
        ok: false,
        error: {
          code: "EXPORT_REJECTED",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }, [busy, locale, model, ports.export, renderer, report, theme]);

  return {
    exportCsv,
    exportPng,
    available: { csv: model !== null, png: model !== null && renderer !== null },
    busy,
  };
}
