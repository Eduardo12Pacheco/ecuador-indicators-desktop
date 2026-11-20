import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { loadRankingModel } from "../../../core/application/use-cases/load-ranking-model";
import { formatValue, formatYear } from "../../../core/domain/format";
import { type Catalog, geographyName, indicatorName, type Year } from "../../../core/domain/model";
import { buildRankingOption } from "../../charts/build-ranking-option";
import { ChartCanvas } from "../../charts/ChartCanvas";
import { chartThemeFor } from "../../charts/chart-theme";
import type { ChartRendererFactory } from "../../charts/renderer";
import { SegmentedControl } from "../../design/primitives/SegmentedControl/SegmentedControl";
import { useTheme } from "../../design/ThemeProvider";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import controlStyles from "./CompareControls.module.css";
import { CompareEmpty, CompareError, CompareSkeleton } from "./CompareStates";
import styles from "./CompareTab.module.css";
import { RankingTable } from "./RankingTable";
import { rankingYearOptions } from "./ranking-years";
import { DEFAULT_RANKING_INDICATOR, useRankingState } from "./use-compare-state";

type DataView = "chart" | "table";

/** Compare ranking: every geography for one indicator and year (S4b). */
export function RankingTab({
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
  const { state, update } = useRankingState(catalog);

  const yearsQuery = useQuery({
    queryKey: ["compare", "ranking-years", state?.indicator],
    enabled: state !== null,
    queryFn: async () => {
      if (state === null) {
        throw new Error("ranking state is not ready");
      }
      const iso3s = catalog.geographies.map((geography) => geography.iso3);
      return ports.dataset.getObservations([state.indicator], iso3s);
    },
  });
  const yearsResult = yearsQuery.data;
  const yearOptions = useMemo(
    () => rankingYearOptions(yearsResult?.ok === true ? yearsResult.value : []),
    [yearsResult],
  );
  const effectiveYear: Year | null =
    state?.year !== null && state?.year !== undefined && yearOptions.years.includes(state.year)
      ? state.year
      : yearOptions.defaultYear;

  const modelQuery = useQuery({
    queryKey: ["compare", "ranking", state?.indicator, effectiveYear],
    enabled: state !== null && effectiveYear !== null,
    queryFn: async () => {
      if (state === null || effectiveYear === null) {
        throw new Error("ranking model is not ready");
      }
      return loadRankingModel(ports.dataset, {
        indicator: state.indicator,
        year: effectiveYear,
      });
    },
  });
  const modelResult = modelQuery.data;
  const model = modelResult?.ok === true ? modelResult.value : null;
  const theme = chartThemeFor(resolved);

  const option = useMemo(
    () => (model === null ? null : buildRankingOption(model, theme, locale)),
    [locale, model, theme],
  );

  if (state === null || yearsQuery.isPending) {
    return <CompareSkeleton />;
  }

  if (yearsResult !== undefined && !yearsResult.ok) {
    return (
      <CompareError
        message={yearsResult.error.message}
        details={`${yearsResult.error.code}: ${yearsResult.error.message}`}
        onRetry={() => {
          void yearsQuery.refetch();
        }}
      />
    );
  }

  if (yearOptions.years.length === 0 || effectiveYear === null) {
    return (
      <CompareEmpty
        title={t("compare.ranking.empty.title")}
        description={t("compare.ranking.empty.description")}
        actionLabel={t("compare.ranking.reset")}
        onAction={() => update({ indicator: DEFAULT_RANKING_INDICATOR, year: null })}
      />
    );
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

  if (modelQuery.isPending || model === null) {
    return <CompareSkeleton />;
  }

  const yearLabel = formatYear(effectiveYear, locale);
  const indicatorLabel = indicatorName(model.indicator, lang);
  const chartYears = model.ranked.map((_, index) => index as Year);
  const announce = (target: Year): string => {
    const row = model.ranked[Number(target)];
    if (row === undefined) {
      return "";
    }
    return t("compare.chart.rankingAnnounce", {
      geography: geographyName(row.geography, lang),
      value: formatValue(row.value, model.indicator, locale),
    });
  };

  return (
    <div className={styles.tab}>
      <div className={styles.controls}>
        <label className={controlStyles.field}>
          <span>{t("compare.ranking.indicator")}</span>
          <select
            value={model.indicator.code}
            onChange={(event) => update({ indicator: event.target.value as never, year: null })}
          >
            {[...catalog.indicators]
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((indicator) => (
                <option key={indicator.code} value={indicator.code}>
                  {indicatorName(indicator, lang)}
                </option>
              ))}
          </select>
        </label>
        <label className={controlStyles.field}>
          <span>{t("compare.ranking.year")}</span>
          <select
            value={effectiveYear}
            onChange={(event) => update({ year: Number(event.target.value) as Year })}
          >
            {yearOptions.years.map((value) => (
              <option key={value} value={value}>
                {formatYear(value, locale)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className={styles.section} aria-labelledby="ranking-chart-title">
        <div className={styles.toolbar}>
          <h2 id="ranking-chart-title" className={styles.sectionTitle}>
            {t("compare.tab.ranking")}
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
        <p className={styles.description}>{t("compare.ranking.description")}</p>
        {view === "table" ? (
          <RankingTable model={model} />
        ) : (
          <>
            <ChartCanvas
              option={option ?? {}}
              ariaLabel={t("compare.chart.rankingSummary", {
                indicator: indicatorLabel,
                year: yearLabel,
              })}
              years={chartYears}
              announce={announce}
              testId="ranking-chart"
              {...(chartRendererFactory === undefined
                ? {}
                : { rendererFactory: chartRendererFactory })}
            />
            {model.missing.length > 0 ? (
              <p className={styles.description}>
                {t("compare.ranking.missingNote", {
                  names: model.missing
                    .map((geography) => geographyName(geography, lang))
                    .join(", "),
                })}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
