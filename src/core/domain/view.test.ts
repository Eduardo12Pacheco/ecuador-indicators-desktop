import { anything, assert, property } from "fast-check";
import { describe, expect, it } from "vitest";

import { indicatorCode, iso3, type ViewSpec, year } from "./model";
import { MAX_NAME_CHARS, validateViewName, validateViewSpec } from "./view";

const explore = (overrides: Partial<Extract<ViewSpec, { kind: "explore" }>> = {}): ViewSpec => ({
  kind: "explore",
  indicator: indicatorCode("NY.GDP.MKTP.CD"),
  geographies: [iso3("ECU")],
  from: null,
  to: null,
  transform: "level",
  baseYear: null,
  chart: "line",
  ...overrides,
});

const trajectories = (
  overrides: Partial<Extract<ViewSpec, { kind: "trajectories" }>> = {},
): ViewSpec => ({
  kind: "trajectories",
  indicators: [indicatorCode("NY.GDP.MKTP.CD"), indicatorCode("FP.CPI.TOTL.ZG")],
  geography: iso3("ECU"),
  baseYear: null,
  ...overrides,
});

describe("validateViewName", () => {
  it("accepts 1 to 80 trimmed characters", () => {
    expect(validateViewName("GDP").ok).toBe(true);
    expect(validateViewName("  GDP  ").ok).toBe(true);
    expect(validateViewName("x".repeat(MAX_NAME_CHARS)).ok).toBe(true);
  });

  it("rejects empty and over-long names", () => {
    expect(validateViewName("").ok).toBe(false);
    expect(validateViewName("   ").ok).toBe(false);
    expect(validateViewName("x".repeat(MAX_NAME_CHARS + 1)).ok).toBe(false);
  });

  it("counts code points, not UTF-16 units", () => {
    expect(validateViewName("😀".repeat(MAX_NAME_CHARS)).ok).toBe(true);
    expect(validateViewName("😀".repeat(MAX_NAME_CHARS + 1)).ok).toBe(false);
  });
});

describe("validateViewSpec", () => {
  it("accepts valid specs", () => {
    expect(validateViewSpec(explore()).ok).toBe(true);
    expect(validateViewSpec(explore({ geographies: [iso3("ECU"), iso3("COL")] })).ok).toBe(true);
    expect(validateViewSpec(trajectories()).ok).toBe(true);
    expect(
      validateViewSpec({ kind: "ranking", indicator: indicatorCode("X"), year: year(2020) }).ok,
    ).toBe(true);
  });

  it("rejects invalid explore specs", () => {
    const cases: ViewSpec[] = [
      explore({ indicator: indicatorCode("") }),
      explore({ geographies: [] }),
      explore({ geographies: [iso3("COL")] }),
      explore({ geographies: [iso3("ecu")] }),
      explore({ geographies: [iso3("ECU"), iso3("ECU")] }),
      explore({ geographies: [iso3("ECU"), iso3("co")] }),
      explore({
        geographies: [iso3("ECU"), iso3("C"), iso3("P"), iso3("X"), iso3("Y"), iso3("Z")],
      }),
      explore({ from: 1800 as never }),
      explore({ to: 2200 as never }),
      explore({ from: year(2020), to: year(2010) }),
      explore({ baseYear: 1800 as never }),
    ];
    for (const spec of cases) {
      expect(validateViewSpec(spec)).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "VIEW_INVALID" }),
      });
    }
  });

  it("rejects invalid trajectories specs", () => {
    const cases: ViewSpec[] = [
      trajectories({ indicators: [indicatorCode("A")] }),
      trajectories({
        indicators: [
          indicatorCode("A"),
          indicatorCode("B"),
          indicatorCode("C"),
          indicatorCode("D"),
          indicatorCode("E"),
        ],
      }),
      trajectories({ indicators: [indicatorCode(""), indicatorCode("B")] }),
      trajectories({ indicators: [indicatorCode("A"), indicatorCode("A")] }),
      trajectories({ geography: iso3("ecu") }),
      trajectories({ baseYear: 1800 as never }),
    ];
    for (const spec of cases) {
      expect(validateViewSpec(spec).ok).toBe(false);
    }
  });

  it("rejects invalid ranking specs", () => {
    expect(
      validateViewSpec({ kind: "ranking", indicator: indicatorCode(""), year: year(2020) }).ok,
    ).toBe(false);
    expect(
      validateViewSpec({ kind: "ranking", indicator: indicatorCode("A"), year: 1800 as never }).ok,
    ).toBe(false);
  });

  it("never throws on arbitrary input", () => {
    assert(
      property(anything(), (candidate) => {
        try {
          validateViewSpec(candidate as ViewSpec);
          return true;
        } catch {
          return false;
        }
      }),
      { seed: 42, numRuns: 100 },
    );
  });
});
