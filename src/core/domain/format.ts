/**
 * Locale-aware value formatting (S9): every number, percentage and date goes
 * through `Intl` for the active locale (`en-US` or `es-EC`).
 */

import type { Indicator, Transform, Year } from "./model";

/** Locale identifiers used by the application. */
export const LOCALES = { en: "en-US", es: "es-EC" } as const;

/** True when the locale is Spanish. */
export function isSpanish(locale: string): boolean {
  return locale.toLowerCase().startsWith("es");
}

/** The thousand separator/compact threshold shared by every numeric family. */
const COMPACT_THRESHOLD = 1_000_000;

/** Formats a finite number with a fixed number of grouped decimals. */
function fixed(value: number, locale: string, decimals: number): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Formats a value according to its indicator's `value_kind`.
 *
 * Non-finite inputs render as an em dash instead of throwing, which keeps a
 * corrupt snapshot from breaking a whole page.
 */
export function formatValue(value: number, indicator: Indicator, locale: string): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const decimals = indicator.decimals;
  switch (indicator.valueKind) {
    case "currency": {
      if (Math.abs(value) >= COMPACT_THRESHOLD) {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "USD",
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value);
      }
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    }
    case "number": {
      if (Math.abs(value) >= COMPACT_THRESHOLD) {
        return new Intl.NumberFormat(locale, {
          notation: "compact",
          maximumFractionDigits: 1,
        }).format(value);
      }
      return fixed(value, locale, decimals);
    }
    case "percent": {
      return new Intl.NumberFormat(locale, {
        style: "percent",
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(value / 100);
    }
    case "years": {
      const unit = isSpanish(locale) ? indicator.unitEs || "años" : indicator.unitEn || "years";
      return `${fixed(value, locale, decimals)} ${unit}`;
    }
    case "rate":
    case "index":
      return fixed(value, locale, decimals);
  }
}

/**
 * Formats a value of an Explore series after its transform (S3).
 *
 * `level` keeps the indicator's own formatting; `yoy` is always a percentage
 * and `index` a plain number (base year = 100), because the indicator's unit
 * no longer applies to transformed values.
 */
export function formatTransformedValue(
  value: number,
  indicator: Indicator,
  transform: Transform,
  locale: string,
): string {
  if (transform === "level") {
    return formatValue(value, indicator, locale);
  }
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (transform === "yoy") {
    return new Intl.NumberFormat(locale, {
      style: "percent",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value / 100);
  }
  return fixed(value, locale, 1);
}

/** Options for {@link formatDelta}. */
export interface DeltaOptions {
  /** Decimal places; defaults to 1. */
  readonly decimals?: number;
  /** Treat the value as a percentage in 0..100 space. */
  readonly percent?: boolean;
}

/**
 * Formats a signed delta; magnitudes of one million and above use compact
 * notation, as {@link formatValue} does. Unlike {@link formatValue}, the sign
 * is always shown so a KPI never relies on color alone.
 */
export function formatDelta(value: number, locale: string, options: DeltaOptions = {}): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  const decimals = options.decimals ?? 1;
  const percent = options.percent ?? false;
  if (!percent && Math.abs(value) >= COMPACT_THRESHOLD) {
    return new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
      signDisplay: "always",
    }).format(value);
  }
  return new Intl.NumberFormat(locale, {
    style: percent ? "percent" : "decimal",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: "always",
  }).format(percent ? value / 100 : value);
}

/** Formats a whole-number count with locale grouping (`11,780`). */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
}

/** Formats a year without grouping (never `2,019`). */
export function formatYear(value: Year | number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    maximumFractionDigits: 0,
  }).format(value);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats an ISO date or timestamp for the About page.
 *
 * A date-only value (such as the WDI `lastupdated` day) names a calendar day,
 * not an instant, so it is formatted in UTC; in the Americas it would
 * otherwise render one day early.
 */
export function formatDate(iso: string, locale: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(DATE_ONLY.test(iso) ? { timeZone: "UTC" } : {}),
  }).format(parsed);
}
