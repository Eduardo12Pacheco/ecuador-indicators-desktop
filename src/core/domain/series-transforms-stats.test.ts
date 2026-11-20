import { assert, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { makeGeography, makeIndicator, points, makeSeries as series } from "../../test/factories";
import { iso3, year } from "./model";
import { alignSeries, clipRange, makeSeries, rankAtYear } from "./series";
import { cagr, summarize } from "./stats";
import { commonBaseYear, indexToBase, yoyChange } from "./transforms";

const FAST_CHECK = { seed: 42, numRuns: 80 } as const;

describe("makeSeries", () => {
  it("sorts points ascending by year", () => {
    const result = makeSeries(makeIndicator(), makeGeography(), [
      { year: 2020, value: 2 },
      { year: 2018, value: 1 },
      { year: 2019, value: 3 },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.points.map((point) => point.year)).toEqual([2018, 2019, 2020]);
    }
  });

  it("rejects duplicate years", () => {
    const result = makeSeries(makeIndicator(), makeGeography(), [
      { year: 2020, value: 2 },
      { year: 2020, value: 3 },
    ]);
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "DUPLICATE_YEAR" }),
    });
  });

  it("rejects non-finite values", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = makeSeries(makeIndicator(), makeGeography(), [{ year: 2020, value }]);
      expect(result).toEqual({
        ok: false,
        error: expect.objectContaining({ code: "NON_FINITE" }),
      });
    }
  });

  it("accepts an empty input", () => {
    const result = makeSeries(makeIndicator(), makeGeography(), []);
    expect(result.ok).toBe(true);
  });
});

describe("clipRange", () => {
  const base = series([
    [2018, 1],
    [2019, 2],
    [2020, 3],
  ]);

  it("clips inclusively", () => {
    const result = clipRange(base, year(2019), year(2020));
    expect(result.ok && result.value.points.map((point) => point.year)).toEqual([2019, 2020]);
  });

  it("keeps open bounds open", () => {
    expect(clipRange(base, null, year(2019)).ok).toBe(true);
    expect(clipRange(base, year(2019), null).ok).toBe(true);
  });

  it("rejects a reversed range", () => {
    const result = clipRange(base, year(2020), year(2019));
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });
});

describe("alignSeries", () => {
  it("uses the union of years and marks gaps", () => {
    const aligned = alignSeries([
      series([
        [2018, 1],
        [2020, 3],
      ]),
      series([
        [2019, 2],
        [2020, 4],
      ]),
    ]);
    expect(aligned.years).toEqual([2018, 2019, 2020]);
    expect(aligned.columns).toEqual([
      [1, null, 3],
      [null, 2, 4],
    ]);
  });

  it("retains every observation exactly once", () => {
    assert(
      property(integer({ min: 1900, max: 2000 }), integer({ min: 1, max: 10 }), (start, length) => {
        const entries = Array.from({ length }, (_, index) => [start + index, index + 1] as const);
        const aligned = alignSeries([series(entries), series([])]);
        const nonNull = aligned.columns.flat().filter((value) => value !== null);
        return nonNull.length === entries.length;
      }),
      FAST_CHECK,
    );
  });
});

describe("rankAtYear", () => {
  it("sorts descending with ISO3 tie-breaks and lists missing last", () => {
    const result = rankAtYear(
      [
        { iso3: iso3("COL"), points: points([[2020, 10]]) },
        { iso3: iso3("ECU"), points: points([[2020, 10]]) },
        { iso3: iso3("PER"), points: points([[2020, 5]]) },
        { iso3: iso3("BOL"), points: points([[2019, 99]]) },
      ],
      year(2020),
    );
    expect(result.ranked.map((entry) => entry.iso3)).toEqual(["COL", "ECU", "PER"]);
    expect(result.missing).toEqual(["BOL"]);
  });
});

describe("transforms", () => {
  it("yoy is zero for a constant series", () => {
    assert(
      property(
        integer({ min: -1_000_000, max: 1_000_000 }),
        integer({ min: 1900, max: 2000 }),
        integer({ min: 1, max: 20 }),
        (value, start, length) => {
          const entries = Array.from(
            { length: length + 1 },
            (_, index) => [start + index, value] as const,
          );
          const result = yoyChange(series(entries));
          return result.points.every((point) => point.value === 0);
        },
      ),
      FAST_CHECK,
    );
  });

  it("skips gaps, the first year and zero denominators", () => {
    const result = yoyChange(
      series([
        [2018, 0],
        [2019, 100],
        [2021, 150],
        [2022, 0],
        [2023, 50],
      ]),
    );
    expect(result.points).toEqual([{ year: year(2022), value: -100 }]);
  });

  it("indexes to 100 at the base year and preserves ratios", () => {
    assert(
      property(
        integer({ min: 1, max: 1000 }),
        integer({ min: 1, max: 1000 }),
        integer({ min: 0, max: 2 }),
        integer({ min: 0, max: 2 }),
        (a, b, baseIndex, otherIndex) => {
          const entries = [a, b, a + b].map((value, index) => [2000 + index, value] as const);
          const result = indexToBase(series(entries), year(2000 + baseIndex));
          if (!result.ok) {
            return false;
          }
          const indexed = result.value.points;
          const base = indexed[baseIndex];
          const other = indexed[otherIndex];
          if (base === undefined || other === undefined) {
            return false;
          }
          const ratio = indexed[otherIndex]?.value ?? 0;
          const expected = ((entries[otherIndex]?.[1] ?? 0) / (entries[baseIndex]?.[1] ?? 1)) * 100;
          return Math.abs(base.value - 100) < 1e-9 && Math.abs(ratio - expected) < 1e-9;
        },
      ),
      FAST_CHECK,
    );
  });

  it("reports a missing base year and a zero base", () => {
    expect(indexToBase(series([[2020, 1]]), year(2019))).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "BASE_YEAR_MISSING" }),
    });
    expect(indexToBase(series([[2020, 0]]), year(2020))).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "BASE_VALUE_ZERO" }),
    });
  });

  it("finds the earliest common year", () => {
    expect(
      commonBaseYear([
        series([
          [2018, 1],
          [2019, 2],
          [2020, 3],
        ]),
        series([
          [2019, 4],
          [2020, 5],
        ]),
      ]),
    ).toBe(2019);
    expect(commonBaseYear([series([[2020, 1]]), series([[2021, 1]])])).toBeNull();
    expect(commonBaseYear([])).toBeNull();
  });
});

describe("stats", () => {
  it("returns null for empty and single-point CAGR", () => {
    expect(cagr(series([]))).toBeNull();
    expect(cagr(series([[2020, 5]]))).toBeNull();
  });

  it("matches the doubling formula", () => {
    assert(
      property(integer({ min: 1, max: 30 }), (years) => {
        const result = cagr(
          series([
            [2000, 100],
            [2000 + years, 200],
          ]),
        );
        const expected = (2 ** (1 / years) - 1) * 100;
        return result !== null && Math.abs(result - expected) < 1e-9;
      }),
      FAST_CHECK,
    );
  });

  it("rejects non-positive endpoints", () => {
    expect(
      cagr(
        series([
          [2000, 0],
          [2001, 2],
        ]),
      ),
    ).toBeNull();
    expect(
      cagr(
        series([
          [2000, 2],
          [2001, -1],
        ]),
      ),
    ).toBeNull();
  });

  it("summarizes latest, previous, change, min and max", () => {
    const summary = summarize(
      series([
        [2018, 10],
        [2019, 4],
        [2020, 12],
      ]),
    );
    expect(summary).not.toBeNull();
    expect(summary).toMatchObject({
      count: 3,
      firstYear: 2018,
      lastYear: 2020,
      latest: { year: 2020, value: 12 },
      previous: { year: 2019, value: 4 },
      change: { abs: 8, pct: 200 },
      min: { year: 2019, value: 4 },
      max: { year: 2020, value: 12 },
    });
  });

  it("handles a single point and a zero previous value", () => {
    const single = summarize(series([[2020, 3]]));
    expect(single).toMatchObject({ previous: null, change: null, min: { year: 2020 } });
    const zero = summarize(
      series([
        [2019, 0],
        [2020, 5],
      ]),
    );
    expect(zero?.change).toEqual({ abs: 5, pct: null });
  });

  it("returns null for an empty series", () => {
    expect(summarize(series([]))).toBeNull();
  });
});
