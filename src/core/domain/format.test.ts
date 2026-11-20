import { assert, double, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { makeIndicator } from "../../test/factories";
import {
  formatCount,
  formatDate,
  formatDelta,
  formatTransformedValue,
  formatValue,
  formatYear,
  isSpanish,
  LOCALES,
} from "./format";

const FAST_CHECK = { seed: 42, numRuns: 100 } as const;

describe("formatValue", () => {
  it("formats currency below and above the compact threshold", () => {
    const indicator = makeIndicator({ decimals: 0 });
    expect(formatValue(1234.5, indicator, LOCALES.en)).toBe("$1,235");
    expect(formatValue(2_500_000, indicator, LOCALES.en)).toMatch(/^\$2\.5M$/);
    expect(formatValue(-2_500_000, indicator, LOCALES.en)).toMatch(/^-\$2\.5M$/);
  });

  it("formats numbers grouped and compact", () => {
    const indicator = makeIndicator({
      valueKind: "number",
      decimals: 1,
      unitEn: "people",
      unitEs: "personas",
    });
    expect(formatValue(1234.56, indicator, LOCALES.en)).toBe("1,234.6");
    expect(formatValue(12_345_678, indicator, LOCALES.en)).toBe("12.3M");
  });

  it("formats percentages in 0..100 space", () => {
    const indicator = makeIndicator({ valueKind: "percent", decimals: 1 });
    expect(formatValue(12.34, indicator, LOCALES.en)).toBe("12.3%");
    expect(formatValue(12.34, indicator, LOCALES.es)).toContain("12,3");
  });

  it("formats years with the localized unit", () => {
    const indicator = makeIndicator({
      valueKind: "years",
      decimals: 1,
      unitEn: "years",
      unitEs: "años",
    });
    expect(formatValue(76.4, indicator, LOCALES.en)).toBe("76.4 years");
    expect(formatValue(76.4, indicator, LOCALES.es)).toContain("años");
  });

  it("falls back to a default years unit", () => {
    const indicator = makeIndicator({ valueKind: "years", decimals: 0, unitEn: "", unitEs: "" });
    expect(formatValue(70, indicator, LOCALES.en)).toBe("70 years");
    expect(formatValue(70, indicator, LOCALES.es)).toContain("años");
  });

  it("formats rates and indexes", () => {
    const rate = makeIndicator({ valueKind: "rate", decimals: 1 });
    const index = makeIndicator({ valueKind: "index", decimals: 1 });
    expect(formatValue(12.34, rate, LOCALES.en)).toBe("12.3");
    expect(formatValue(12.34, index, LOCALES.en)).toBe("12.3");
  });

  it("renders non-finite values as an em dash", () => {
    const indicator = makeIndicator();
    expect(formatValue(Number.NaN, indicator, LOCALES.en)).toBe("—");
    expect(formatValue(Number.POSITIVE_INFINITY, indicator, LOCALES.en)).toBe("—");
  });

  it("never throws for finite numbers in both locales", () => {
    assert(
      property(double({ noNaN: true, noDefaultInfinity: true }), (value) => {
        for (const kind of ["currency", "number", "percent", "years", "rate", "index"] as const) {
          const indicator = makeIndicator({ valueKind: kind, decimals: 2 });
          for (const locale of Object.values(LOCALES)) {
            const rendered = formatValue(value, indicator, locale);
            if (Object.is(rendered, "")) {
              return false;
            }
          }
        }
        return true;
      }),
      FAST_CHECK,
    );
  });
});

describe("formatDelta", () => {
  it("always shows an explicit sign", () => {
    expect(formatDelta(2.5, LOCALES.en)).toBe("+2.5");
    expect(formatDelta(-2.5, LOCALES.en)).toBe("-2.5");
    expect(formatDelta(0, LOCALES.en)).toBe("+0.0");
    expect(formatDelta(12.34, LOCALES.en, { decimals: 1, percent: true })).toBe("+12.3%");
  });

  it("renders non-finite deltas as an em dash", () => {
    expect(formatDelta(Number.NaN, LOCALES.en)).toBe("—");
  });

  it("compacts large magnitudes like formatValue so KPI cards never overflow", () => {
    expect(formatDelta(6_518_182_000, LOCALES.en, { decimals: 0 })).toBe("+6.5B");
    expect(formatDelta(-1_250_000, LOCALES.en, { decimals: 0 })).toBe("-1.3M");
    expect(formatDelta(999_999, LOCALES.en, { decimals: 0 })).toBe("+999,999");
    expect(formatDelta(6_518_182_000, LOCALES.es, { decimals: 0 })).toMatch(/^\+6518,2\s?M$/);
  });
});

describe("formatTransformedValue", () => {
  const currency = makeIndicator({ valueKind: "currency", decimals: 0 });
  const percent = makeIndicator({ valueKind: "percent", decimals: 1 });

  it("keeps the indicator's own formatting for the level transform", () => {
    expect(formatTransformedValue(130_300_000_000, currency, "level", LOCALES.en)).toBe("$130.3B");
    expect(formatTransformedValue(5.25, percent, "level", LOCALES.en)).toBe("5.3%");
  });

  it("formats year-over-year changes as percentages whatever the indicator unit is", () => {
    expect(formatTransformedValue(5.25, currency, "yoy", LOCALES.en)).toBe("5.3%");
    expect(formatTransformedValue(-30, currency, "yoy", LOCALES.en)).toBe("-30.0%");
  });

  it("formats index values as plain numbers (base year = 100)", () => {
    expect(formatTransformedValue(100, currency, "index", LOCALES.en)).toBe("100.0");
    expect(formatTransformedValue(1234.56, percent, "index", LOCALES.en)).toBe("1,234.6");
  });

  it("renders non-finite values as an em dash for every transform", () => {
    expect(formatTransformedValue(Number.NaN, currency, "yoy", LOCALES.en)).toBe("—");
    expect(formatTransformedValue(Number.POSITIVE_INFINITY, currency, "index", LOCALES.en)).toBe(
      "—",
    );
  });
});

describe("formatCount", () => {
  it("groups whole numbers for the active locale", () => {
    expect(formatCount(11_780, LOCALES.en)).toBe("11,780");
    expect(formatCount(11_780, LOCALES.es)).toMatch(/^11[.\s\u00a0]?780$/);
    expect(formatCount(38, LOCALES.en)).toBe("38");
  });
});

describe("date and year formatting", () => {
  it("formats years without grouping", () => {
    expect(formatYear(2019, LOCALES.en)).toBe("2019");
    expect(formatYear(2019, LOCALES.es)).toBe("2019");
  });

  it("keeps a date-only value on its own calendar day west of UTC", () => {
    const original = process.env.TZ;
    process.env.TZ = "America/Guayaquil";
    try {
      expect(formatDate("2026-11-11", LOCALES.en)).toBe("Nov 11, 2026");
      expect(formatDate("2026-11-11", LOCALES.es)).toMatch(/11/);
    } finally {
      if (original === undefined) {
        delete process.env.TZ;
      } else {
        process.env.TZ = original;
      }
    }
  });

  it("formats ISO dates and passes invalid input through", () => {
    expect(formatDate("2026-11-20T00:00:00Z", LOCALES.en)).toContain("2026");
    expect(formatDate("not-a-date", LOCALES.en)).toBe("not-a-date");
  });

  it("detects Spanish locales", () => {
    expect(isSpanish("es-EC")).toBe(true);
    expect(isSpanish("en-US")).toBe(false);
  });
});
