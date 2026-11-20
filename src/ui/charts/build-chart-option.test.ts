import type { EChartsCoreOption } from "echarts/core";
import { describe, expect, it } from "vitest";

import type { ExploreModel } from "../../core/application/use-cases/models";
import { iso3, year } from "../../core/domain/model";
import { makeGeography, makeIndicator, makeSeries } from "../../test/factories";
import { alignValues, buildChartOption, CHART_ATTRIBUTION, chartYears } from "./build-chart-option";
import { FALLBACK_LIGHT } from "./chart-theme";

const indicator = makeIndicator();
const ecuador = makeGeography();
const colombia = makeGeography({
  iso3: iso3("COL"),
  iso2: "CO",
  nameEn: "Colombia",
  nameEs: "Colombia",
  sortOrder: 2,
});

function model(overrides: Partial<ExploreModel> = {}): ExploreModel {
  return {
    indicator,
    geographies: [ecuador, colombia],
    series: [
      makeSeries(
        [
          [2000, 10],
          [2001, 11],
          [2003, 13],
        ],
        { indicator, geography: ecuador },
      ),
      makeSeries(
        [
          [2000, 20],
          [2002, 22],
        ],
        { indicator, geography: colombia },
      ),
    ],
    transform: "level",
    baseYear: null,
    from: null,
    to: null,
    chart: "line",
    ...overrides,
  };
}

interface RawSeries {
  readonly name: string;
  readonly type: string;
  readonly data: readonly (number | null)[];
  readonly connectNulls: boolean;
  readonly symbol: string;
  readonly itemStyle: { readonly color: string };
  readonly lineStyle: { readonly width: number; readonly type: unknown; readonly color: string };
  readonly areaStyle?: { readonly opacity: number };
}

function series(option: EChartsCoreOption): RawSeries[] {
  return (option as unknown as { series: RawSeries[] }).series;
}

describe("buildChartOption", () => {
  it("keeps series order, resolves token colors and preserves gaps as null", () => {
    const option = buildChartOption(model(), FALLBACK_LIGHT, "en-US");
    const built = series(option);
    expect(built.map((item) => item.name)).toEqual(["Ecuador", "Colombia"]);
    expect(built[0]?.data).toEqual([10, 11, null, 13]);
    expect(built[1]?.data).toEqual([20, null, 22, null]);
    expect(built[0]?.itemStyle.color).toBe(FALLBACK_LIGHT.series[0]);
    expect(built[1]?.itemStyle.color).toBe(FALLBACK_LIGHT.series[1]);
    expect(built[0]?.connectNulls).toBe(false);
  });

  it("uses dotted/dashed styles for aggregates and wider Ecuador lines", () => {
    const world = makeGeography({
      iso3: iso3("WLD"),
      iso2: "1W",
      nameEn: "World",
      nameEs: "Mundo",
      isAggregate: true,
      sortOrder: 7,
    });
    const latin = makeGeography({
      iso3: iso3("LCN"),
      iso2: "ZJ",
      nameEn: "Latin America & Caribbean",
      nameEs: "América Latina y el Caribe",
      isAggregate: true,
      sortOrder: 6,
    });
    const worldSeries = makeSeries([[2000, 5]], { indicator, geography: world });
    const latinSeries = makeSeries([[2000, 6]], { indicator, geography: latin });
    const option = buildChartOption(
      model({
        geographies: [ecuador, latin, world],
        series: [
          makeSeries([[2000, 10]], { indicator, geography: ecuador }),
          latinSeries,
          worldSeries,
        ],
      }),
      FALLBACK_LIGHT,
      "en-US",
    );
    const built = series(option);
    expect(built[0]?.lineStyle.width).toBe(3);
    expect(built[1]?.lineStyle.width).toBe(2.5);
    expect(built[1]?.lineStyle.type).toBe("dashed");
    expect(built[2]?.lineStyle.type).toBe("dotted");
    expect(built[2]?.itemStyle.color).toBe(FALLBACK_LIGHT.series[5]);
  });

  it("renders area and bar variants without changing the data", () => {
    const line = series(buildChartOption(model(), FALLBACK_LIGHT, "en-US"));
    const area = series(buildChartOption(model({ chart: "area" }), FALLBACK_LIGHT, "en-US"));
    const bar = series(buildChartOption(model({ chart: "bar" }), FALLBACK_LIGHT, "en-US"));
    expect(area[0]?.areaStyle?.opacity).toBeGreaterThan(0);
    expect(area[0]?.data).toEqual(line[0]?.data);
    expect(bar[0]?.type).toBe("bar");
    expect(bar[1]?.data).toEqual(line[1]?.data);
  });

  it("changes only data for YoY and index transforms", () => {
    const level = model();
    const transformed = model({
      transform: "index",
      baseYear: year(2000),
      series: level.series.map((item) => ({
        ...item,
        points: item.points.map((point) => ({ ...point, value: 100 })),
      })),
    });
    const levelOption = buildChartOption(level, FALLBACK_LIGHT, "en-US");
    const indexOption = buildChartOption(transformed, FALLBACK_LIGHT, "en-US");
    expect(series(indexOption)[0]?.data).toEqual([100, 100, null, 100]);
    expect(series(indexOption)[0]?.itemStyle.color).toBe(series(levelOption)[0]?.itemStyle.color);
    expect(series(indexOption)[0]?.lineStyle.type).toBe(series(levelOption)[0]?.lineStyle.type);
  });

  it("is aria-enabled in both modes and adds export title and attribution", () => {
    const view = buildChartOption(model(), FALLBACK_LIGHT, "en-US");
    expect((view as unknown as { aria: { enabled: boolean } }).aria.enabled).toBe(true);
    expect((view as unknown as { title?: unknown }).title).toBeUndefined();

    const exported = buildChartOption(model(), FALLBACK_LIGHT, "en-US", { mode: "export" });
    const raw = exported as unknown as {
      title: { text: string; subtext: string };
      graphic: { style: { text: string } }[];
      backgroundColor: string;
    };
    expect(raw.title.text).toBe("GDP (current US$)");
    expect(raw.title.subtext).toContain("Ecuador");
    expect(raw.graphic[0]?.style.text).toBe(CHART_ATTRIBUTION.en);
    expect(raw.backgroundColor).toBe(FALLBACK_LIGHT.background);
  });

  it("localizes names and attribution for Spanish", () => {
    const spanish = buildChartOption(model(), FALLBACK_LIGHT, "es-EC", { mode: "export" });
    const raw = spanish as unknown as {
      title: { text: string };
      graphic: { style: { text: string } }[];
    };
    expect(raw.title.text).toBe("PIB (US$ corrientes)");
    expect(raw.graphic[0]?.style.text).toBe(CHART_ATTRIBUTION.es);
    expect(series(spanish)[1]?.name).toBe("Colombia");
  });

  it("aligns values and unions years deterministically", () => {
    const first = makeSeries([[2002, 2]], { indicator, geography: ecuador });
    const second = makeSeries([[2000, 0]], { indicator, geography: colombia });
    expect(chartYears([first, second])).toEqual([2000, 2002]);
    expect(alignValues(first, [year(2000), year(2002)])).toEqual([null, 2]);
  });
});
