import { describe, expect, it } from "vitest";

import { type Catalog, indicatorCode, iso3, year } from "../../../core/domain/model";
import { makeCatalog, makeIndicator } from "../../../test/factories";
import {
  DEFAULT_RANKING_INDICATOR,
  DEFAULT_TRAJECTORY_INDICATORS,
  MAX_TRAJECTORY_INDICATORS,
  parseRankingState,
  parseTrajectoriesState,
  serializeRankingState,
  serializeTrajectoriesState,
} from "./use-compare-state";

function params(entries: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(entries);
}

function biggerCatalog(): Catalog {
  const base = makeCatalog();
  return {
    ...base,
    indicators: [
      ...base.indicators,
      makeIndicator({ code: indicatorCode("SP.POP.TOTL"), sortOrder: 19 }),
      makeIndicator({ code: indicatorCode("SP.DYN.LE00.IN"), sortOrder: 22 }),
      makeIndicator({ code: indicatorCode("IT.NET.USER.ZS"), sortOrder: 37 }),
    ],
  };
}

describe("trajectories state", () => {
  it("uses documented defaults when the URL is empty", () => {
    const state = parseTrajectoriesState(params(), makeCatalog());
    expect(state.indicators).toEqual([...DEFAULT_TRAJECTORY_INDICATORS]);
    expect(state.geography).toBe("ECU");
    expect(state.baseYear).toBeNull();
  });

  it("drops unknown and duplicate indicators and keeps the selection order", () => {
    const state = parseTrajectoriesState(
      params({ i: "FP.CPI.TOTL.ZG,NOPE,FP.CPI.TOTL.ZG,NY.GDP.MKTP.CD", g: "COL", base: "2001" }),
      makeCatalog(),
    );
    expect(state.indicators).toEqual(["FP.CPI.TOTL.ZG", "NY.GDP.MKTP.CD"]);
    expect(state.geography).toBe("COL");
    expect(state.baseYear).toBe(2001);
  });

  it("caps the list at four indicators", () => {
    const state = parseTrajectoriesState(
      params({
        i: "NY.GDP.MKTP.CD,FP.CPI.TOTL.ZG,SP.POP.TOTL,SP.DYN.LE00.IN,IT.NET.USER.ZS",
      }),
      biggerCatalog(),
    );
    expect(state.indicators).toHaveLength(MAX_TRAJECTORY_INDICATORS);
  });

  it("pads a short selection with defaults so at least two series load", () => {
    const state = parseTrajectoriesState(params({ i: "FP.CPI.TOTL.ZG" }), makeCatalog());
    expect(state.indicators).toHaveLength(2);
    expect(state.indicators[0]).toBe("FP.CPI.TOTL.ZG");
    expect(state.indicators[1]).toBe(DEFAULT_TRAJECTORY_INDICATORS[0]);
  });

  it("falls back for an unknown geography and drops an invalid base year", () => {
    const state = parseTrajectoriesState(params({ g: "XXX", base: "1700" }), makeCatalog());
    expect(state.geography).toBe("ECU");
    expect(state.baseYear).toBeNull();
  });

  it("round-trips a non-default state", () => {
    const state = {
      indicators: [indicatorCode("FP.CPI.TOTL.ZG"), indicatorCode("NY.GDP.MKTP.CD")] as const,
      geography: iso3("COL"),
      baseYear: year(2000),
    };
    const serialized = serializeTrajectoriesState(state);
    expect(parseTrajectoriesState(new URLSearchParams(serialized), makeCatalog())).toEqual(state);
  });

  it("omits defaults when serializing", () => {
    expect(
      serializeTrajectoriesState({
        indicators: [...DEFAULT_TRAJECTORY_INDICATORS],
        geography: iso3("ECU"),
        baseYear: null,
      }),
    ).toBe("");
  });
});

describe("ranking state", () => {
  it("uses the documented default indicator and no year", () => {
    const state = parseRankingState(params(), makeCatalog());
    expect(state.indicator).toBe(DEFAULT_RANKING_INDICATOR);
    expect(state.year).toBeNull();
  });

  it("accepts a known indicator and year, and sanitizes the rest", () => {
    expect(parseRankingState(params({ i: "FP.CPI.TOTL.ZG", y: "2019" }), makeCatalog())).toEqual({
      indicator: "FP.CPI.TOTL.ZG",
      year: 2019,
    });
    expect(parseRankingState(params({ i: "NOPE", y: "abc" }), makeCatalog())).toEqual({
      indicator: DEFAULT_RANKING_INDICATOR,
      year: null,
    });
  });

  it("round-trips and omits defaults", () => {
    expect(serializeRankingState({ indicator: DEFAULT_RANKING_INDICATOR, year: null })).toBe("");
    const state = { indicator: indicatorCode("FP.CPI.TOTL.ZG"), year: year(2019) };
    const serialized = serializeRankingState(state);
    expect(parseRankingState(new URLSearchParams(serialized), makeCatalog())).toEqual(state);
  });
});
