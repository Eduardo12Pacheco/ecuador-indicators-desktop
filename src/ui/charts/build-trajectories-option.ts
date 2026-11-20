/**
 * Pure ECharts option builder for Compare trajectories (S4a).
 *
 * Each selected indicator becomes one line indexed to the chosen base year,
 * using slots 1 to 4 in selection order. A dashed reference line at 100 makes
 * "above or below the base" readable even without colour.
 */

import type { EChartsCoreOption } from "echarts/core";
import type { TrajectoriesModel } from "../../core/application/use-cases/models";
import { geographyName, indicatorName, type Lang } from "../../core/domain/model";
import {
  alignValues,
  CHART_ATTRIBUTION,
  type ChartBuildOptions,
  chartYears,
} from "./build-chart-option";
import type { ChartTheme } from "./chart-theme";
import { echartsLineType, styleForSlot } from "./series-style";

function languageOf(locale: string): Lang {
  return locale.toLowerCase().startsWith("es") ? "es" : "en";
}

function formatIndex(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

/** Builds the option for the Compare trajectories tab. */
export function buildTrajectoriesOption(
  model: TrajectoriesModel,
  theme: ChartTheme,
  locale: string,
  options: ChartBuildOptions = {},
): EChartsCoreOption {
  const mode = options.mode ?? "view";
  const lang = languageOf(locale);
  const years = chartYears(model.series);
  const names = model.indicators.map((indicator) => indicatorName(indicator, lang));

  const series = model.series.map((item, index) => {
    const style = styleForSlot(index + 1);
    const color = theme.series[style.slot - 1] ?? theme.series[0];
    return {
      name: indicatorName(item.indicator, lang),
      type: "line",
      data: alignValues(item, years),
      connectNulls: false,
      smooth: false,
      showSymbol: false,
      symbol: style.symbol,
      emphasis: { focus: "series" },
      itemStyle: { color },
      lineStyle: { color, width: 2.5, type: echartsLineType(style.lineType) },
      ...(mode === "export" ? { animation: false } : {}),
    };
  });

  const reference = {
    name: "",
    type: "line",
    data: years.map(() => 100),
    silent: true,
    symbol: "none",
    tooltip: { show: false },
    itemStyle: { color: theme.borderStrong },
    lineStyle: { color: theme.borderStrong, width: 1, type: "dashed" },
    z: 0,
    ...(mode === "export" ? { animation: false } : {}),
  };

  const option: EChartsCoreOption = {
    backgroundColor: mode === "export" ? theme.background : "transparent",
    animationDuration: 200,
    aria: { enabled: true },
    textStyle: { fontFamily: theme.fontUi, color: theme.text },
    title:
      mode === "export"
        ? {
            text: names.join(" · "),
            subtext: `${geographyName(model.geography, lang)} · ${
              lang === "es" ? "índice (año base = 100)" : "index (base year = 100)"
            }`,
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
    legend:
      mode === "export"
        ? {
            data: names,
            bottom: 28,
            left: 16,
            textStyle: { color: theme.textMuted, fontFamily: theme.fontUi, fontSize: 12 },
          }
        : {
            // Colour is never the only cue (D9), but the dash/symbol key must be visible.
            show: true,
            data: names,
            top: 0,
            right: 16,
            itemWidth: 24,
            itemHeight: 8,
            textStyle: { color: theme.textMuted, fontFamily: theme.fontUi, fontSize: 12 },
          },
    grid: {
      left: 8,
      right: 16,
      top: mode === "export" ? 88 : 40,
      bottom: mode === "export" ? 64 : 12,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontFamily: theme.fontUi, fontSize: 12 },
      valueFormatter: (value: unknown) =>
        formatIndex(typeof value === "number" ? value : Number(value), locale),
    },
    xAxis: {
      type: "category",
      data: years.map((value) => String(value)),
      boundaryGap: false,
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontFamily: theme.fontUi,
        fontSize: 12,
        formatter: (value: string | number) =>
          new Intl.NumberFormat(locale, { useGrouping: false }).format(Number(value)),
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: theme.border } },
      axisLine: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontFamily: theme.fontUi,
        fontSize: 12,
        formatter: (value: number) => formatIndex(value, locale),
      },
    },
    series: [...series, reference],
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
