import { describe, expect, it } from "vitest";

import { indicatorCode, iso3, type ViewSpec, year } from "../../../core/domain/model";
import { makeCatalog } from "../../../test/factories";
import { defaultViewName, describeViewSpec } from "./view-summary";

const catalog = makeCatalog();
const explore: ViewSpec = {
  kind: "explore",
  indicator: indicatorCode("NY.GDP.MKTP.CD"),
  geographies: [iso3("ECU"), iso3("COL")],
  from: year(2000),
  to: year(2020),
  transform: "level",
  baseYear: null,
  chart: "line",
};

describe("describeViewSpec", () => {
  it("names the indicator and geographies in the active language", () => {
    expect(describeViewSpec(explore, catalog, "en")).toBe("GDP (current US$) · Ecuador, Colombia");
    expect(describeViewSpec(explore, catalog, "es")).toBe(
      "PIB (US$ corrientes) · Ecuador, Colombia",
    );
  });

  it("summarizes trajectories and rankings", () => {
    expect(
      describeViewSpec(
        {
          kind: "trajectories",
          indicators: [indicatorCode("NY.GDP.MKTP.CD"), indicatorCode("FP.CPI.TOTL.ZG")],
          geography: iso3("ECU"),
          baseYear: year(2000),
        },
        catalog,
        "en",
      ),
    ).toBe("GDP (current US$) · Inflation, consumer prices (annual %) · Ecuador");
    expect(
      describeViewSpec(
        { kind: "ranking", indicator: indicatorCode("FP.CPI.TOTL.ZG"), year: year(2024) },
        catalog,
        "en",
      ),
    ).toBe("Inflation, consumer prices (annual %) · 2024");
  });

  it("falls back to the code when the catalog does not know an indicator", () => {
    expect(
      describeViewSpec(
        { kind: "ranking", indicator: indicatorCode("UNKNOWN.CODE"), year: year(2024) },
        catalog,
        "en",
      ),
    ).toBe("UNKNOWN.CODE · 2024");
  });
});

describe("defaultViewName", () => {
  it("is a non-empty name of at most 80 characters", () => {
    const name = defaultViewName(explore, catalog, "en");
    expect(name.length).toBeGreaterThan(0);
    expect([...name].length).toBeLessThanOrEqual(80);
  });

  it("truncates long summaries with an ellipsis", () => {
    const longCatalog = {
      ...catalog,
      indicators: catalog.indicators.map((indicator) => ({
        ...indicator,
        nameEn: "N".repeat(120),
      })),
    };
    const name = defaultViewName(explore, longCatalog, "en");
    expect([...name].length).toBe(80);
    expect(name.endsWith("…")).toBe(true);
  });
});
