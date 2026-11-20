import { assert, property, string } from "fast-check";
import { parse } from "papaparse";
import { describe, expect, it } from "vitest";
import { makeGeography, makeIndicator, makeSeries as series } from "../../test/factories";
import { buildExportRows, CSV_HEADER, type ExportModel, type ExportRow, toCsv } from "./csv";
import { iso3 } from "./model";

const FAST_CHECK = { seed: 42, numRuns: 100 } as const;

function model(): ExportModel {
  return {
    indicator: makeIndicator(),
    geographies: [
      makeGeography(),
      makeGeography({ iso3: iso3("COL"), nameEn: "Colombia", nameEs: "Colombia" }),
    ],
    series: [
      series(
        [
          [2020, 10],
          [2021, 20],
        ],
        { geography: makeGeography() },
      ),
      series([[2020, 5]], {
        geography: makeGeography({ iso3: iso3("COL"), nameEn: "Colombia", nameEs: "Colombia" }),
      }),
    ],
    lang: "en",
  };
}

describe("buildExportRows", () => {
  it("flattens series in geography order and by year", () => {
    const rows = buildExportRows(model());
    expect(rows.map((row) => [row.iso3, row.year])).toEqual([
      ["ECU", 2020],
      ["ECU", 2021],
      ["COL", 2020],
    ]);
    expect(rows[0]).toEqual({
      indicatorCode: "NY.GDP.MKTP.CD",
      indicatorName: "GDP (current US$)",
      iso3: "ECU",
      geography: "Ecuador",
      year: 2020,
      value: 10,
      unit: "current US$",
    });
  });

  it("uses the active language for names and units", () => {
    const rows = buildExportRows({ ...model(), lang: "es" });
    expect(rows[0]?.indicatorName).toBe("PIB (US$ corrientes)");
    expect(rows[0]?.geography).toBe("Ecuador");
    expect(rows[0]?.unit).toBe("US$ corrientes");
  });

  it("skips geographies without a series and handles an empty model", () => {
    const rows = buildExportRows({
      indicator: makeIndicator(),
      geographies: [makeGeography({ iso3: iso3("PER") })],
      series: [],
      lang: "en",
    });
    expect(rows).toEqual([]);
  });
});

describe("toCsv", () => {
  it("writes the exact header and CRLF endings without a BOM", () => {
    const csv = toCsv([]);
    expect(csv).toBe(`${CSV_HEADER}\r\n`);
  });

  it("quotes fields containing comma, quote, CR or LF and doubles quotes", () => {
    const row: ExportRow = {
      indicatorCode: "X",
      indicatorName: 'a,"b"\nc\rd',
      iso3: "ECU",
      geography: "plain",
      year: 2020,
      value: 1.5,
      unit: "u",
    };
    const csv = toCsv([row]);
    expect(csv).toContain('"a,""b""\nc\rd"');
  });

  it("round-trips arbitrary strings through papaparse", () => {
    assert(
      property(string(), string(), string(), (indicatorName, geography, unit) => {
        const row: ExportRow = {
          indicatorCode: "NY.GDP.MKTP.CD",
          indicatorName,
          iso3: "ECU",
          geography,
          year: 2020,
          value: 1.25,
          unit,
        };
        const parsed = parse<Record<string, string>>(toCsv([row]), { header: true });
        const first = parsed.data[0];
        return (
          first?.indicator_name === indicatorName &&
          first.geography === geography &&
          first.unit === unit &&
          first.value === "1.25"
        );
      }),
      FAST_CHECK,
    );
  });
});
