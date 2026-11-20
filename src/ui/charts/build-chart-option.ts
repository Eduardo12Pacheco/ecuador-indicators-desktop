/**
 * Pure ECharts option builders (D10).
 *
 * Builders never touch the DOM: components pass a resolved {@link ChartTheme}
 * and locale, which keeps the interesting logic unit-testable. Export mode is
 * the same chart plus a title, legend and the World Bank attribution footer.
 */

import type { EChartsCoreOption } from "echarts/core";
import type { ExploreModel } from "../../core/application/use-cases/models";
import { formatValue, formatYear } from "../../core/domain/format";
import {
  geographyName,
  indicatorName,
  indicatorUnit,
  type Lang,
  type Series,
  type Year,
} from "../../core/domain/model";
import type { ChartTheme } from "./chart-theme";
import { echartsLineType, styleForGeography } from "./series-style";

/** How the chart is going to be consumed. */
export type ChartBuildMode = "view" | "export";

/** Options shared by every chart builder. */
export interface ChartBuildOptions {
  readonly mode?: ChartBuildMode;
}

/** Attribution printed on exported images (S7). */
export const CHART_ATTRIBUTION: Readonly<Record<Lang, string>> = {
  en: "Source: The World Bank, World Development Indicators (CC BY 4.0)",
  es: "Fuente: Banco Mundial, Indicadores del Desarrollo Mundial (CC BY 4.0)",
};

/** Union of all years present in the model, ascending. */
export function chartYears(series: readonly Series[]): Year[] {
  const years = new Set<number>();
  for (const item of series) {
    for (const point of item.points) {
      years.add(point.year);
    }
  }
  return [...years].sort((left, right) => left - right) as Year[];
}

/** Aligns one series to a shared year axis, preserving gaps as `null`. */
export function alignValues(series: Series, years: readonly Year[]): (number | null)[] {
  const byYear = new Map<number, number>();
  for (const point of series.points) {
    byYear.set(point.year, point.value);
  }
  return years.map((year) => byYear.get(year) ?? null);
}

function languageOf(locale: string): Lang {
  return locale.toLowerCase().startsWith("es") ? "es" : "en";
}

/**
 * Builds the option for an Explore model.
 *
 * Series order follows the model (Ecuador first), colors and line/symbol styles
 * are resolved per geography, and `null` keeps gaps instead of connecting them.
 */
export function buildChartOption(
  model: ExploreModel,
  theme: ChartTheme,
  locale: string,
  options: ChartBuildOptions = {},
): EChartsCoreOption {
  const mode = options.mode ?? "view";
  const lang = languageOf(locale);
  const years = chartYears(model.series);
  const isBar = model.chart === "bar";
  const names = model.series.map((item) => geographyName(item.geography, lang));
  const attribution = CHART_ATTRIBUTION[lang];

  const series = model.series.map((item, index) => {
    const style = styleForGeography(item.geography.iso3, index);
    const color = theme.series[style.slot - 1] ?? theme.series[0];
    const chartSeries = {
      name: geographyName(item.geography, lang),
      type: isBar ? "bar" : "line",
      data: alignValues(item, years),
      connectNulls: false,
      smooth: false,
      symbol: style.symbol,
      symbolSize: item.geography.iso3 === "ECU" ? 7 : 6,
      showSymbol: false,
      emphasis: { focus: "series" },
      itemStyle: { color },
      lineStyle: {
        color,
        width: item.geography.iso3 === "ECU" ? 3 : 2.5,
        type: echartsLineType(style.lineType),
      },
      ...(model.chart === "area"
        ? { areaStyle: { color, opacity: 0.12 }, lineStyle: { color, width: 2.5 } }
        : {}),
      ...(isBar ? { barMaxWidth: 18 } : {}),
      ...(mode === "export" ? { animation: false } : {}),
    };
    return chartSeries;
  });

  const option: EChartsCoreOption = {
    backgroundColor: mode === "export" ? theme.background : "transparent",
    animationDuration: 200,
    aria: { enabled: true },
    textStyle: { fontFamily: theme.fontUi, color: theme.text },
    title:
      mode === "export"
        ? {
            text: indicatorName(model.indicator, lang),
            subtext: `${names.join(" · ")}  ·  ${indicatorUnit(model.indicator, lang)}`,
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
        : { show: false, data: names },
    grid: {
      left: 8,
      right: 16,
      top: mode === "export" ? 88 : 16,
      bottom: mode === "export" ? 64 : 12,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: theme.surface,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontFamily: theme.fontUi, fontSize: 12 },
      valueFormatter: (value: unknown) =>
        formatValue(typeof value === "number" ? value : Number(value), model.indicator, locale),
    },
    xAxis: {
      type: "category",
      data: years.map((year) => String(year)),
      boundaryGap: isBar,
      axisLine: { lineStyle: { color: theme.border } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontFamily: theme.fontUi,
        fontSize: 12,
        formatter: (value: string | number) => formatYear(Number(value), locale),
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
        formatter: (value: number) => formatValue(value, model.indicator, locale),
      },
    },
    series,
    ...(mode === "export"
      ? {
          graphic: [
            {
              type: "text",
              left: 16,
              bottom: 10,
              style: {
                text: attribution,
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
