import { assert, constantFrom, integer, option, property, record, uniqueArray } from "fast-check";
import { describe, expect, it } from "vitest";
import { makeCatalog, makeGeography, makeIndicator } from "../../test/factories";
import { type Catalog, indicatorCode, iso3, year } from "./model";
import type { ExploreState } from "./view-state";
import { parseExploreState, serializeExploreState } from "./view-state";

const FAST_CHECK = { seed: 42, numRuns: 100 } as const;

function catalog(): Catalog {
  const base = makeCatalog();
  return {
    ...base,
    geographies: [
      ...base.geographies,
      makeGeography({
        iso3: iso3("PER"),
        iso2: "PE",
        nameEn: "Peru",
        nameEs: "Perú",
        sortOrder: 3,
      }),
      makeGeography({
        iso3: iso3("CHL"),
        iso2: "CL",
        nameEn: "Chile",
        nameEs: "Chile",
        sortOrder: 4,
      }),
      makeGeography({
        iso3: iso3("BOL"),
        iso2: "BO",
        nameEn: "Bolivia",
        nameEs: "Bolivia",
        sortOrder: 5,
      }),
      makeGeography({
        iso3: iso3("WLD"),
        iso2: "1W",
        nameEn: "World",
        nameEs: "Mundo",
        sortOrder: 7,
      }),
    ],
  };
}

function parse(query: string, cat: Catalog = catalog()): ExploreState {
  return parseExploreState(new URLSearchParams(query), cat);
}

describe("parseExploreState", () => {
  it("uses defaults for an empty query", () => {
    expect(parse("")).toEqual({
      indicator: "NY.GDP.MKTP.CD",
      geographies: ["ECU"],
      from: null,
      to: null,
      transform: "level",
      baseYear: null,
      chart: "line",
    });
  });

  it("falls back for an unknown indicator, including when the default is absent", () => {
    expect(parse("i=NOPE").indicator).toBe("NY.GDP.MKTP.CD");
    const onlyCpi: Catalog = {
      ...catalog(),
      indicators: [makeIndicator({ code: indicatorCode("FP.CPI.TOTL.ZG") })],
    };
    expect(parseExploreState(new URLSearchParams(""), onlyCpi).indicator).toBe("FP.CPI.TOTL.ZG");
  });

  it("sanitizes geographies: known, unique, max five and Ecuador first", () => {
    expect(parse("g=COL,ECU,COL,AAA").geographies).toEqual(["ECU", "COL"]);
    expect(parse("g=col").geographies).toEqual(["ECU", "COL"]);
    expect(parse("g=COL,PER,CHL,BOL,WLD").geographies).toEqual(["ECU", "COL", "PER", "CHL", "BOL"]);
  });

  it("swaps a reversed range and drops invalid years", () => {
    expect(parse("from=2020&to=2010")).toMatchObject({ from: 2010, to: 2020 });
    expect(parse("from=abc&to=1800")).toMatchObject({ from: null, to: null });
    expect(parse("from=2010.5")).toMatchObject({ from: null });
  });

  it("clears a base year outside the visible range", () => {
    expect(parse("from=2010&to=2020&base=1999").baseYear).toBeNull();
    expect(parse("from=2010&to=2020&base=2015").baseYear).toBe(2015);
    expect(parse("base=2015").baseYear).toBe(2015);
  });

  it("normalizes transform and chart values", () => {
    expect(parse("t=yoy&ch=area")).toMatchObject({ transform: "yoy", chart: "area" });
    expect(parse("t=index&ch=bar")).toMatchObject({ transform: "index", chart: "bar" });
    expect(parse("t=bogus&ch=bogus")).toMatchObject({ transform: "level", chart: "line" });
  });
});

describe("serializeExploreState", () => {
  it("omits every default", () => {
    expect(
      serializeExploreState({
        indicator: indicatorCode("NY.GDP.MKTP.CD"),
        geographies: [iso3("ECU")],
        from: null,
        to: null,
        transform: "level",
        baseYear: null,
        chart: "line",
      }),
    ).toBe("");
  });

  it("emits a deterministic key order", () => {
    expect(
      serializeExploreState({
        indicator: indicatorCode("FP.CPI.TOTL.ZG"),
        geographies: [iso3("ECU"), iso3("COL")],
        from: year(2000),
        to: year(2020),
        transform: "index",
        baseYear: year(2010),
        chart: "bar",
      }),
    ).toBe("i=FP.CPI.TOTL.ZG&g=ECU%2CCOL&from=2000&to=2020&t=index&base=2010&ch=bar");
  });

  it("round-trips generated valid states", () => {
    const validState = record({
      indicator: constantFrom(indicatorCode("NY.GDP.MKTP.CD"), indicatorCode("FP.CPI.TOTL.ZG")),
      extraGeographies: uniqueArray(
        constantFrom(iso3("COL"), iso3("PER"), iso3("CHL"), iso3("BOL"), iso3("WLD")),
        { maxLength: 4 },
      ),
      from: option(integer({ min: 1950, max: 2020 }), { nil: null }),
      span: integer({ min: 0, max: 70 }),
      transform: constantFrom<"level" | "yoy" | "index">("level", "yoy", "index"),
      baseOffset: option(integer({ min: 0, max: 10 }), { nil: null }),
      chart: constantFrom<"line" | "area" | "bar">("line", "area", "bar"),
    }).map((generated): ExploreState => {
      const to = generated.from === null ? null : year(generated.from + generated.span);
      const from = generated.from === null ? null : year(generated.from);
      let baseYear: ExploreState["baseYear"] = null;
      if (generated.baseOffset !== null) {
        baseYear = from === null ? null : year(from + generated.baseOffset);
        if (baseYear !== null && to !== null && baseYear > to) {
          baseYear = null;
        }
      }
      return {
        indicator: generated.indicator,
        geographies: [iso3("ECU"), ...generated.extraGeographies],
        from,
        to,
        transform: generated.transform,
        baseYear,
        chart: generated.chart,
      };
    });

    assert(
      property(validState, (state) => {
        const serialized = serializeExploreState(state);
        const parsed = parseExploreState(new URLSearchParams(serialized), catalog());
        return JSON.stringify(parsed) === JSON.stringify(state);
      }),
      FAST_CHECK,
    );
  });
});
