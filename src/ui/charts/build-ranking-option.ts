/**
 * Pure ECharts option builder for Compare ranking (S4b).
 *
 * Horizontal bars are drawn in the descending order produced by the ranking use
 * case; Ecuador uses slot 1 while every other geography stays neutral so the
 * highlighted row also survives a monochrome print.
 */

import type { EChartsCoreOption } from "echarts/core";
import type { RankingModel } from "../../core/application/use-cases/models";
import { formatValue, formatYear } from "../../core/domain/format";
import { geographyName, indicatorName, type Lang } from "../../core/domain/model";
import { CHART_ATTRIBUTION, type ChartBuildOptions } from "./build-chart-option";
import type { ChartTheme } from "./chart-theme";

const ECUADOR = "ECU";

function languageOf(locale: string): Lang {
  return locale.toLowerCase().startsWith("es") ? "es" : "en";
}

/** Builds the option for the Compare ranking chart. */
export function buildRankingOption(
  model: RankingModel,
  theme: ChartTheme,
  locale: string,
  options: ChartBuildOptions = {},
): EChartsCoreOption {
  const mode = options.mode ?? "view";
  const lang = languageOf(locale);
  const names = model.ranked.map((row) => geographyName(row.geography, lang));
  const bars = model.ranked.map((row) => ({
    value: row.value,
    itemStyle: {
      color: row.geography.iso3 === ECUADOR ? theme.series[0] : theme.borderStrong,
    },
  }));

  const option: EChartsCoreOption = {
    backgroundColor: mode === "export" ? theme.background : "transparent",
    animationDuration: 200,
    aria: { enabled: true },
    textStyle: { fontFamily: theme.fontUi, color: theme.text },
    title:
      mode === "export"
        ? {
            text: indicatorName(model.indicator, lang),
            subtext: formatYear(model.year, locale),
            left: 16,
            top: 12,
            textStyle: {
              color: theme.text,
              fontFamily: theme.fontUi,
              fontSize: 16,
              fontWeight: 600,
            },
            subtextStyle: { color: theme.textMuted, fontFamily: theme.fontUi, fontSize: 12 },
          }
        : undefined,
    grid: {
      left: 8,
      right: mode === "export" ? 96 : 88,
      top: mode === "export" ? 88 : 16,
      bottom: mode === "export" ? 64 : 12,
      containLabel: true,
    },
    tooltip: {
      trigger: "item",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontFamily: theme.fontUi, fontSize: 12 },
      valueFormatter: (value: unknown) =>
        formatValue(typeof value === "number" ? value : Number(value), model.indicator, locale),
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.border } },
      axisLine: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontFamily: theme.fontUi,
        fontSize: 12,
        formatter: (value: number) => formatValue(value, model.indicator, locale),
      },
    },
    yAxis: {
      type: "category",
      data: names,
      inverse: true,
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false },
      axisLabel: { color: theme.textMuted, fontFamily: theme.fontUi, fontSize: 12 },
    },
    series: [
      {
        name: indicatorName(model.indicator, lang),
        type: "bar",
        data: bars,
        barMaxWidth: 18,
        label: {
          show: true,
          position: "right",
          color: theme.text,
          fontFamily: theme.fontUi,
          fontSize: 12,
          formatter: (params: unknown) => {
            const raw =
              typeof params === "object" && params !== null && "value" in params
                ? (params as { readonly value: unknown }).value
                : params;
            return formatValue(
              typeof raw === "number" ? raw : Number(raw),
              model.indicator,
              locale,
            );
          },
        },
        ...(mode === "export" ? { animation: false } : {}),
      },
    ],
    ...(mode === "export"
      ? {
          graphic: [
            {
              type: "text",
              left: 16,
              bottom: 10,
              style: {
                text: CHART_ATTRIBUTION[lang],
                fill: theme.textMuted,
                font: `11px ${theme.fontUi}`,
              },
            },
          ],
        }
      : {}),
  };
  return option;
}
