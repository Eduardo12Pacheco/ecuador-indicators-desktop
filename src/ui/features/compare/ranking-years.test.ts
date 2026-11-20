import { describe, expect, it } from "vitest";

import { indicatorCode, iso3, type Observation, year } from "../../../core/domain/model";
import { rankingYearOptions } from "./ranking-years";

const CODE = indicatorCode("NY.GDP.MKTP.CD");

function observation(iso: string, valueYear: number): Observation {
  return { indicatorCode: CODE, iso3: iso3(iso), year: year(valueYear), value: valueYear };
}

describe("rankingYearOptions", () => {
  it("lists only years with at least one value, ascending", () => {
    const options = rankingYearOptions([
      observation("ECU", 2001),
      observation("COL", 2000),
      observation("PER", 2001),
    ]);
    expect(options.years).toEqual([2000, 2001]);
  });

  it("defaults to the latest year with at least five geographies", () => {
    const rows = [
      observation("ECU", 2000),
      observation("COL", 2000),
      observation("PER", 2000),
      observation("CHL", 2000),
      observation("BOL", 2000),
      observation("ECU", 2001),
      observation("COL", 2001),
    ];
    expect(rankingYearOptions(rows).defaultYear).toBe(2000);
  });

  it("falls back to the latest year with any value", () => {
    const options = rankingYearOptions([
      observation("ECU", 1999),
      observation("ECU", 2000),
      observation("COL", 2000),
    ]);
    expect(options.defaultYear).toBe(2000);
  });

  it("returns no years and no default for an empty snapshot", () => {
    expect(rankingYearOptions([])).toEqual({ years: [], defaultYear: null });
  });
});
