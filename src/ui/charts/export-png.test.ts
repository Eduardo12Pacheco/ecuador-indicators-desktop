import { describe, expect, it } from "vitest";

import type { ExploreModel } from "../../core/application/use-cases/models";
import { makeGeography, makeIndicator, makeSeries } from "../../test/factories";
import { FakeChartRenderer } from "../../test/fake-chart-renderer";
import { FALLBACK_LIGHT } from "./chart-theme";
import { buildExportOption, chartPngDataUrl, dataUrlToBytes } from "./export-png";

const indicator = makeIndicator();
const geography = makeGeography();
const model: ExploreModel = {
  indicator,
  geographies: [geography],
  series: [
    makeSeries(
      [
        [2000, 1],
        [2001, 2],
      ],
      { indicator, geography },
    ),
  ],
  transform: "level",
  baseYear: null,
  from: null,
  to: null,
  chart: "line",
};

describe("export-png", () => {
  it("builds the export-mode option", () => {
    const option = buildExportOption(model, FALLBACK_LIGHT, "en-US") as unknown as {
      title: { text: string };
    };
    expect(option.title.text).toBe("GDP (current US$)");
  });

  it("asks the renderer for a 2x PNG and returns the data URL", () => {
    const renderer = new FakeChartRenderer();
    const url = chartPngDataUrl(renderer, model, FALLBACK_LIGHT, "en-US");
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(renderer.dataUrlOperations).toEqual([{ pixelRatio: 2 }]);
    expect(renderer.options).toHaveLength(1);
  });

  it("decodes a base64 PNG data URL into bytes", () => {
    expect([...dataUrlToBytes("data:image/png;base64,iVBORw0KGgo=")]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(() => dataUrlToBytes("data:image/jpeg;base64,AA==")).toThrow(
      "expected a base64 PNG data URL",
    );
  });
});
