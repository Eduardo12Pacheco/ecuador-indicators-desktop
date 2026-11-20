import type { EChartsCoreOption } from "echarts/core";
import { describe, expect, it } from "vitest";

import type { RankingModel } from "../../core/application/use-cases/models";
import { iso3, year } from "../../core/domain/model";
import { makeGeography, makeIndicator } from "../../test/factories";
import { buildRankingOption } from "./build-ranking-option";
import { FALLBACK_LIGHT } from "./chart-theme";

const ecuador = makeGeography();
const colombia = makeGeography({
  iso3: iso3("COL"),
  iso2: "CO",
  nameEn: "Colombia",
  nameEs: "Colombia",
  sortOrder: 2,
});
const peru = makeGeography({
  iso3: iso3("PER"),
  iso2: "PE",
  nameEn: "Peru",
  nameEs: "Perú",
  sortOrder: 3,
});

function model(): RankingModel {
  return {
    indicator: makeIndicator(),
    year: year(2020),
    ranked: [
      { geography: peru, value: 300 },
      { geography: ecuador, value: 200 },
      { geography: colombia, value: 100 },
    ],
    missing: [makeGeography({ iso3: iso3("WLD"), nameEn: "World", sortOrder: 7 })],
  };
}

type OptionShape = {
  readonly aria?: { readonly enabled?: boolean };
  readonly title?: { readonly text?: string; readonly subtext?: string };
  readonly graphic?: readonly { readonly style?: { readonly text?: string } }[];
  readonly yAxis: {
    readonly type: string;
    readonly data: readonly string[];
    readonly inverse?: boolean;
  };
  readonly xAxis: { readonly type: string };
  readonly series: readonly {
    readonly type: string;
    readonly data: readonly {
      readonly value: number;
      readonly itemStyle?: { readonly color?: string };
    }[];
  }[];
};

function shape(option: EChartsCoreOption): OptionShape {
  return option as unknown as OptionShape;
}

describe("buildRankingOption", () => {
  it("draws horizontal bars in the ranked descending order", () => {
    const option = shape(buildRankingOption(model(), FALLBACK_LIGHT, "en-US"));
    expect(option.xAxis.type).toBe("value");
    expect(option.yAxis.type).toBe("category");
    expect(option.yAxis.data).toEqual(["Peru", "Ecuador", "Colombia"]);
    expect(option.yAxis.inverse).toBe(true);
    expect(option.series[0]?.type).toBe("bar");
    expect(option.series[0]?.data.map((entry) => entry.value)).toEqual([300, 200, 100]);
  });

  it("highlights Ecuador and keeps the other bars neutral", () => {
    const option = shape(buildRankingOption(model(), FALLBACK_LIGHT, "en-US"));
    const data = option.series[0]?.data ?? [];
    expect(data[0]?.itemStyle?.color).toBe(FALLBACK_LIGHT.borderStrong);
    expect(data[1]?.itemStyle?.color).toBe(FALLBACK_LIGHT.series[0]);
    expect(data[2]?.itemStyle?.color).toBe(FALLBACK_LIGHT.borderStrong);
  });

  it("uses localized geography names and enables aria", () => {
    const option = shape(buildRankingOption(model(), FALLBACK_LIGHT, "es-EC"));
    expect(option.yAxis.data).toEqual(["Perú", "Ecuador", "Colombia"]);
    expect(option.aria?.enabled).toBe(true);
  });

  it("adds the indicator, year and attribution in export mode", () => {
    const option = shape(buildRankingOption(model(), FALLBACK_LIGHT, "en-US", { mode: "export" }));
    expect(option.title?.text).toContain("GDP (current US$)");
    expect(option.title?.subtext).toContain("2020");
    expect(option.graphic?.[0]?.style?.text).toContain("World Bank");
  });

  it("does not include missing geographies as bars", () => {
    const option = shape(buildRankingOption(model(), FALLBACK_LIGHT, "en-US"));
    expect(option.yAxis.data).toHaveLength(3);
    expect(option.yAxis.data).not.toContain("World");
  });

  it("renders an empty chart without throwing", () => {
    const empty: RankingModel = { ...model(), ranked: [], missing: [] };
    const option = shape(buildRankingOption(empty, FALLBACK_LIGHT, "en-US"));
    expect(option.yAxis.data).toEqual([]);
    expect(option.series[0]?.data).toEqual([]);
  });
});
