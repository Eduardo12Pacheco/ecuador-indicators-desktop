import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { loadTrajectoriesModel } from "../../../core/application/use-cases/load-trajectories-model";
import { formatYear } from "../../../core/domain/format";
import type { Catalog, Series, Year } from "../../../core/domain/model";
import { geographyName, indicatorName } from "../../../core/domain/model";
import { chartYears } from "../../charts/build-chart-option";
import { buildTrajectoriesOption } from "../../charts/build-trajectories-option";
import { ChartCanvas } from "../../charts/ChartCanvas";
import { chartThemeFor } from "../../charts/chart-theme";
import type { ChartRendererFactory } from "../../charts/renderer";
import { SegmentedControl } from "../../design/primitives/SegmentedControl/SegmentedControl";
import { useTheme } from "../../design/ThemeProvider";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import { BaseYearControl } from "./BaseYearControl";
import { CompareEmpty, CompareError, CompareSkeleton } from "./CompareStates";
import styles from "./CompareTab.module.css";
import { GeographySelect } from "./GeographySelect";
import { IndicatorMultiPicker } from "./IndicatorMultiPicker";
import { TrajectoriesTable } from "./TrajectoriesTable";
import { DEFAULT_TRAJECTORY_INDICATORS, useTrajectoriesState } from "./use-compare-state";

type DataView = "chart" | "table";

function sharedYears(series: readonly Series[]): Year[] {
  const first = series[0];
  if (first === undefined) {
    return [];
  }
  const remaining = series.slice(1).map((item) => new Set(item.points.map((point) => point.year)));
  return first.points
    .map((point) => point.year)
    .filter((candidate) => remaining.every((years) => years.has(candidate)))
    .sort((left, right) => left - right) as Year[];
}

function formatIndex(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/** Compare trajectories: 2 to 4 indicators indexed to a base year (S4a). */
export function TrajectoriesTab({
  catalog,
  chartRendererFactory,
}: {
  readonly catalog: Catalog;
  readonly chartRendererFactory?: ChartRendererFactory;
}) {
  const ports = usePorts();
  const { t, lang, locale } = useT();
  const { resolved } = useTheme();
  const [view, setView] = useState<DataView>("chart");
  const { state, update } = useTrajectoriesState(catalog);

  const modelQuery = useQuery({
    queryKey: ["compare", "trajectories", state],
    enabled: state !== null,
    queryFn: async () => {
      if (state === null) {
        throw new Error("trajectories state is not ready");
      }
      return loadTrajectoriesModel(ports.dataset, {
        indicators: state.indicators,
        geography: state.geography,
        baseYear: state.baseYear,
      });
    },
  });
  const modelResult = modelQuery.data;
  const model = modelResult?.ok === true ? modelResult.value : null;
  const theme = chartThemeFor(resolved);

  const staleBaseYear =
    modelResult !== undefined &&
    !modelResult.ok &&
    (modelResult.error.code === "BASE_YEAR_MISSING" ||
      modelResult.error.code === "BASE_VALUE_ZERO");

  useEffect(() => {
    if (staleBaseYear && state !== null && state.baseYear !== null) {
      update({ baseYear: null });
    }
  }, [staleBaseYear, state, update]);

  const option = useMemo(
    () => (model === null ? null : buildTrajectoriesOption(model, theme, locale)),
    [locale, model, theme],
  );
  const years = useMemo(() => (model === null ? [] : chartYears(model.series)), [model]);
  const baseYears = useMemo(() => (model === null ? [] : sharedYears(model.series)), [model]);

  if (modelQuery.isPending || staleBaseYear) {
    return <CompareSkeleton />;
  }

  if (modelResult !== undefined && !modelResult.ok) {
    return (
      <CompareError
        message={modelResult.error.message}
        details={`${modelResult.error.code}: ${modelResult.error.message}`}
        onRetry={() => {
          void modelQuery.refetch();
        }}
      />
    );
  }

  if (state === null) {
    return <CompareSkeleton />;
  }

  if (model === null) {
    return <CompareSkeleton />;
  }

  const geographyLabel = geographyName(model.geography, lang);
  const indicatorLabels = model.indicators.map((indicator) => indicatorName(indicator, lang));
  const baseYear = model.baseYear ?? baseYears[0] ?? null;

  if (baseYear === null) {
    return (
      <div className={styles.tab}>
        <div className={styles.controls}>
          <IndicatorMultiPicker
            indicators={catalog.indicators}
            selected={state.indicators}
            onChange={(indicators) => update({ indicators, baseYear: null })}
          />
          <GeographySelect
            geographies={catalog.geographies}
            value={state.geography}
            onChange={(geography) => update({ geography, baseYear: null })}
          />
        </div>
        <CompareEmpty
          title={t("compare.noCommonYear.title")}
          description={t("compare.noCommonYear.description", { geography: geographyLabel })}
          actionLabel={t("compare.noCommonYear.reset")}
          onAction={() =>
            update({ indicators: [...DEFAULT_TRAJECTORY_INDICATORS], baseYear: null })
          }
        />
      </div>
    );
  }

  const firstSeries = model.series[0];
  const announce = (target: Year): string => {
    const point = firstSeries?.points.find((candidate) => candidate.year === target);
    return t("compare.chart.trajectoriesAnnounce", {
      indicator: firstSeries === undefined ? "" : indicatorName(firstSeries.indicator, lang),
      year: formatYear(target, locale),
      value: point === undefined ? t("common.noData") : formatIndex(point.value, locale),
    });
  };

  return (
    <div className={styles.tab}>
      <div className={styles.controls}>
        <div className={styles.wide}>
          <IndicatorMultiPicker
            indicators={catalog.indicators}
            selected={state.indicators}
            onChange={(indicators) => update({ indicators, baseYear: null })}
          />
        </div>
        <GeographySelect
          geographies={catalog.geographies}
          value={state.geography}
          onChange={(geography) => update({ geography, baseYear: null })}
        />
        <BaseYearControl
          years={baseYears}
          value={baseYear}
          onChange={(next) => update({ baseYear: next })}
        />
      </div>

      <section className={styles.section} aria-labelledby="trajectories-chart-title">
        <div className={styles.toolbar}>
          <h2 id="trajectories-chart-title" className={styles.sectionTitle}>
            {t("compare.tab.trajectories")}
          </h2>
          <SegmentedControl
            label={t("compare.data.view")}
            value={view}
            options={[
              { value: "chart", label: t("compare.data.view") },
              { value: "table", label: t("compare.data.table") },
            ]}
            onValueChange={(value) => setView(value as DataView)}
          />
        </div>
        <p className={styles.description}>{t("compare.trajectories.description")}</p>
        {view === "table" ? (
          <TrajectoriesTable model={model} />
        ) : (
          <ChartCanvas
            option={option ?? {}}
            ariaLabel={t("compare.chart.trajectoriesSummary", {
              indicators: indicatorLabels.join(", "),
              geography: geographyLabel,
              base: formatYear(baseYear, locale),
            })}
            years={years}
            announce={announce}
            testId="trajectories-chart"
            {...(chartRendererFactory === undefined
              ? {}
              : { rendererFactory: chartRendererFactory })}
          />
        )}
      </section>
    </div>
  );
}
