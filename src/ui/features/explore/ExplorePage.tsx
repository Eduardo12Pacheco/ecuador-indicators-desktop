import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import type { AppPorts } from "../../../core/application/ports";
import { loadExploreModel } from "../../../core/application/use-cases/load-explore-model";
import type { ExploreModel } from "../../../core/application/use-cases/models";
import { formatValue, formatYear } from "../../../core/domain/format";
import {
  type Geography,
  geographyName,
  indicatorName,
  iso3,
  type Year,
} from "../../../core/domain/model";
import { DEFAULT_INDICATOR, type ExploreState } from "../../../core/domain/view-state";
import { buildChartOption, chartYears } from "../../charts/build-chart-option";
import { ChartCanvas } from "../../charts/ChartCanvas";
import { chartThemeFor } from "../../charts/chart-theme";
import type { ChartRenderer, ChartRendererFactory } from "../../charts/renderer";
import { Button } from "../../design/primitives/Button/Button";
import { SegmentedControl } from "../../design/primitives/SegmentedControl/SegmentedControl";
import { useTheme } from "../../design/ThemeProvider";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import { ExportMenu } from "../export/ExportMenu";
import type { FileExportKind } from "../export/export-context";
import { useRegisterExport } from "../export/export-context";
import { useExport } from "../export/use-export";
import { CatalogPanel } from "./CatalogPanel";
import { ChartTypeControl } from "./ChartTypeControl";
import { DataTable } from "./DataTable";
import styles from "./ExplorePage.module.css";
import { ExploreEmpty, ExploreError, ExploreSkeleton } from "./ExploreStates";
import { IndicatorHeader } from "./IndicatorHeader";
import { KpiRow } from "./KpiRow";
import { PeersControl } from "./PeersControl";
import { RangeControl } from "./RangeControl";
import { TransformControl } from "./TransformControl";
import { useExploreState } from "./use-explore-state";

type DataView = "chart" | "table";

function commonYears(model: ExploreModel): Year[] {
  const first = model.series[0];
  if (first === undefined) {
    return [];
  }
  const shared = new Set<number>(first.points.map((point) => point.year));
  for (const item of model.series.slice(1)) {
    const years = new Set<number>(item.points.map((point) => point.year));
    for (const candidate of shared) {
      if (!years.has(candidate)) {
        shared.delete(candidate);
      }
    }
  }
  return [...shared].sort((left, right) => left - right) as Year[];
}

function resultDetails(error: { readonly code: string; readonly message: string }): string {
  return `${error.code}: ${error.message}`;
}

/** Query that loads the Explore model for the current URL state. */
function useExploreModel(ports: AppPorts, state: ExploreState | null) {
  return useQuery({
    queryKey: ["explore", state],
    enabled: state !== null,
    queryFn: async () => {
      if (state === null) {
        throw new Error("explore state is not ready");
      }
      return loadExploreModel(ports.dataset, {
        indicator: state.indicator,
        geographies: state.geographies,
        from: state.from,
        to: state.to,
        transform: state.transform,
        baseYear: state.baseYear,
        chart: state.chart,
      });
    },
  });
}

/** Explore page: catalog, KPIs, chart/table, range, transform and peers (S3). */
export function ExplorePage({
  chartRendererFactory,
}: {
  readonly chartRendererFactory?: ChartRendererFactory;
} = {}) {
  const ports = usePorts();
  const { locale } = useT();
  const { resolved } = useTheme();
  const [view, setView] = useState<DataView>("chart");

  const catalogQuery = useQuery({
    queryKey: ["dataset", "catalog"],
    queryFn: () => ports.dataset.getCatalog(),
  });
  const catalogResult = catalogQuery.data;
  const catalog = catalogResult?.ok === true ? catalogResult.value : null;
  const { state, update } = useExploreState(catalog);
  const modelQuery = useExploreModel(ports, state);
  const modelResult = modelQuery.data;
  const model = modelResult?.ok === true ? modelResult.value : null;
  const theme = chartThemeFor(resolved);

  const option = useMemo(
    () => (model === null ? null : buildChartOption(model, theme, locale)),
    [model, theme, locale],
  );

  const years = useMemo(() => (model === null ? [] : chartYears(model.series)), [model]);
  const baseYears = useMemo(() => (model === null ? [] : commonYears(model)), [model]);

  if (catalogQuery.isPending) {
    return (
      <div className={styles.page}>
        <ExploreSkeleton />
      </div>
    );
  }

  if (catalogResult !== undefined && !catalogResult.ok) {
    return (
      <div className={styles.page}>
        <ExploreError
          message={catalogResult.error.message}
          details={resultDetails(catalogResult.error)}
          onRetry={() => {
            void catalogQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (catalog === null || state === null) {
    return (
      <div className={styles.page}>
        <ExploreSkeleton />
      </div>
    );
  }

  const indicator = catalog.indicators.find((candidate) => candidate.code === state.indicator);
  const topic =
    indicator === undefined
      ? undefined
      : catalog.topics.find((candidate) => candidate.id === indicator.topicId);

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <CatalogPanel
          catalog={catalog}
          selected={state.indicator}
          onSelect={(code) => update({ indicator: code as ExploreState["indicator"] })}
        />
      </aside>
      <div className={styles.content}>
        {indicator === undefined ? null : <IndicatorHeader indicator={indicator} topic={topic} />}

        {modelQuery.isPending ? <ExploreSkeleton /> : null}

        {modelResult !== undefined && !modelResult.ok ? (
          <ExploreError
            message={modelResult.error.message}
            details={resultDetails(modelResult.error)}
            onRetry={() => {
              void modelQuery.refetch();
            }}
          />
        ) : null}

        {model !== null ? (
          <ExploreContent
            model={model}
            state={state}
            update={update}
            years={years}
            baseYears={baseYears}
            view={view}
            onViewChange={setView}
            availableGeographies={catalog.geographies}
            option={option ?? {}}
            {...(chartRendererFactory === undefined ? {} : { chartRendererFactory })}
          />
        ) : null}
      </div>
    </div>
  );
}

interface ExploreContentProps {
  readonly model: ExploreModel;
  readonly state: ExploreState;
  readonly update: (patch: Partial<ExploreState>) => void;
  readonly years: readonly Year[];
  readonly baseYears: readonly Year[];
  readonly view: DataView;
  readonly onViewChange: (view: DataView) => void;
  readonly availableGeographies: readonly Geography[];
  readonly option: ReturnType<typeof buildChartOption> | null;
  readonly chartRendererFactory?: ChartRendererFactory;
}

function ExploreContent({
  model,
  state,
  update,
  years,
  baseYears,
  view,
  onViewChange,
  availableGeographies,
  option,
  chartRendererFactory,
}: ExploreContentProps) {
  const { t, lang, locale } = useT();
  const { resolved } = useTheme();
  const [renderer, setRenderer] = useState<ChartRenderer | null>(null);
  const chartTheme = useMemo(() => chartThemeFor(resolved), [resolved]);
  const exports = useExport({ model, renderer, theme: chartTheme, locale, lang });
  useRegisterExport(
    exports.available.csv ? exports.exportCsv : undefined,
    exports.available.png ? exports.exportPng : undefined,
  );
  const firstSeries = model.series[0];
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const fromYear = model.from ?? firstYear;
  const toYear = model.to ?? lastYear;
  const indicatorLabel = indicatorName(model.indicator, lang);
  const geographyLabels = model.series.map((item) => geographyName(item.geography, lang));
  const isEmpty = model.series.every((item) => item.points.length === 0);
  const missingGeographies = model.series.filter((item) => item.points.length === 0);

  const announce = (target: Year): string => {
    const point = firstSeries?.points.find((candidate) => candidate.year === target);
    return t("explore.chart.announce", {
      geography: firstSeries === undefined ? "" : geographyName(firstSeries.geography, lang),
      year: formatYear(target, locale),
      value:
        point === undefined
          ? t("common.noData")
          : formatValue(point.value, model.indicator, locale),
    });
  };

  if (isEmpty) {
    return (
      <ExploreEmpty
        {...(state.geographies.length > 1
          ? { onRemovePeers: () => update({ geographies: [iso3("ECU")] }) }
          : {})}
        onReset={() => update({ indicator: DEFAULT_INDICATOR })}
      />
    );
  }

  return (
    <>
      <KpiRow model={model} />
      {missingGeographies.length > 0 ? (
        <div className={styles.notice} role="status">
          <p>
            {t("explore.partialEmpty.description", {
              names: missingGeographies
                .map((item) => geographyName(item.geography, lang))
                .join(", "),
            })}
          </p>
          <div className={styles.noticeActions}>
            {missingGeographies
              .filter((item) => item.geography.iso3 !== "ECU")
              .map((item) => (
                <Button
                  key={item.geography.iso3}
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({
                      geographies: state.geographies.filter((code) => code !== item.geography.iso3),
                    })
                  }
                >
                  {t("explore.partialEmpty.remove", {
                    name: geographyName(item.geography, lang),
                  })}
                </Button>
              ))}
          </div>
        </div>
      ) : null}
      <div className={styles.controls}>
        <RangeControl
          years={years}
          from={state.from}
          to={state.to}
          onRangeChange={(from, to) => update({ from, to })}
        />
        <TransformControl
          transform={state.transform}
          baseYear={state.baseYear ?? model.baseYear}
          baseYears={baseYears}
          onChange={(transform, baseYear) => update({ transform, baseYear })}
        />
        <PeersControl
          geographies={availableGeographies}
          selected={state.geographies}
          onChange={(geographies) => update({ geographies })}
        />
      </div>

      <section className={styles.chartSection} aria-labelledby="chart-title">
        <div className={styles.toolbar}>
          <h2 id="chart-title" className={styles.sectionTitle}>
            {t("explore.chart.title")}
          </h2>
          <div className={styles.toolbarControls}>
            <ExportMenu
              available={exports.available}
              busy={exports.busy}
              onExport={(kind: FileExportKind) => {
                void (kind === "csv" ? exports.exportCsv() : exports.exportPng());
              }}
            />
            <SegmentedControl
              label={t("explore.chart.view")}
              value={view}
              options={[
                { value: "chart", label: t("explore.chart.view") },
                { value: "table", label: t("explore.chart.table") },
              ]}
              onValueChange={(value) => onViewChange(value as DataView)}
            />
            <ChartTypeControl chart={state.chart} onChange={(chart) => update({ chart })} />
          </div>
        </div>
        {view === "table" ? (
          <DataTable model={model} />
        ) : (
          <ChartCanvas
            option={option ?? {}}
            ariaLabel={t("explore.chart.summary", {
              indicator: indicatorLabel,
              geographies: geographyLabels.join(", "),
              from: fromYear === undefined ? "—" : formatYear(fromYear, locale),
              to: toYear === undefined ? "—" : formatYear(toYear, locale),
            })}
            years={firstSeries?.points.map((point) => point.year) ?? []}
            announce={announce}
            testId="chart-canvas"
            onRendererChange={setRenderer}
            {...(chartRendererFactory === undefined
              ? {}
              : { rendererFactory: chartRendererFactory })}
          />
        )}
      </section>
    </>
  );
}
