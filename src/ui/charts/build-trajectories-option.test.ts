import type { EChartsCoreOption } from "echarts/core";
import { describe, expect, it } from "vitest";

import type { TrajectoriesModel } from "../../core/application/use-cases/models";
import { indicatorCode } from "../../core/domain/model";
import { makeGeography, makeIndicator, makeSeries } from "../../test/factories";
import { buildTrajectoriesOption } from "./build-trajectories-option";
import { FALLBACK_LIGHT } from "./chart-theme";

const gdp = makeIndicator();
const inflation = makeIndicator({
  code: indicatorCode("FP.CPI.TOTL.ZG"),
  nameEn: "Inflation, consumer prices (annual %)",
  nameEs: "Inflación, precios al consumidor (% anual)",
  valueKind: "percent",
  decimals: 1,
  sortOrder: 5,
});
const ecuador = makeGeography();

function model(): TrajectoriesModel {
  return {
    indicators: [gdp, inflation],
    geography: ecuador,
    baseYear: 2000 as never,
    series: [
      makeSeries([
        [2000, 100],
        [2001, 110],
        [2002, 120],
      ]),
      makeSeries(
        [
          [2000, 100],
          [2001, 90],
          [2003, 130],
        ],
        {
          indicator: inflation,
          geography: ecuador,
        },
      ),
    ],
  };
}

type OptionShape = {
  readonly aria?: { readonly enabled?: boolean };
  readonly title?: { readonly text?: string };
  readonly graphic?: readonly { readonly style?: { readonly text?: string } }[];
  readonly xAxis: { readonly data: readonly string[] };
  readonly series: readonly {
    readonly name?: string;
    readonly type: string;
    readonly data: readonly (number | null)[];
    readonly lineStyle?: { readonly type?: unknown; readonly color?: string };
    readonly itemStyle?: { readonly color?: string };
  }[];
};

function shape(option: EChartsCoreOption): OptionShape {
  return option as unknown as OptionShape;
}

describe("buildTrajectoriesOption", () => {
  it("draws one indexed line per indicator in selection order", () => {
    const option = shape(buildTrajectoriesOption(model(), FALLBACK_LIGHT, "en-US"));
    expect(option.series.slice(0, 2).map((series) => series.name)).toEqual([
      "GDP (current US$)",
      "Inflation, consumer prices (annual %)",
    ]);
    expect(option.series[0]?.data).toEqual([100, 110, 120, null]);
    expect(option.series[1]?.data).toEqual([100, 90, null, 130]);
    expect(option.series[0]?.itemStyle?.color).toBe(FALLBACK_LIGHT.series[0]);
    expect(option.series[1]?.itemStyle?.color).toBe(FALLBACK_LIGHT.series[1]);
  });

  it("adds a dashed reference line at 100", () => {
    const option = shape(buildTrajectoriesOption(model(), FALLBACK_LIGHT, "en-US"));
    const reference = option.series.at(-1);
    expect(reference?.type).toBe("line");
    expect(reference?.data).toEqual([100, 100, 100, 100]);
    expect(reference?.lineStyle?.type).toBe("dashed");
  });

  it("keeps gaps disconnected and enables the ECharts aria component", () => {
    const option = shape(buildTrajectoriesOption(model(), FALLBACK_LIGHT, "es-EC"));
    expect(option.aria?.enabled).toBe(true);
    expect(option.xAxis.data).toEqual(["2000", "2001", "2002", "2003"]);
  });

  it("adds title, legend and attribution in export mode", () => {
    const option = shape(
      buildTrajectoriesOption(model(), FALLBACK_LIGHT, "en-US", { mode: "export" }),
    );
    expect(option.title?.text).toContain("GDP (current US$)");
    expect(option.graphic?.[0]?.style?.text).toContain("World Bank");
  });
});
