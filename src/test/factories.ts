/**
 * Test factories shared by the core, adapter and use-case suites.
 * Excluded from coverage (`src/test/**`).
 */

import {
  type AppInfo,
  type Catalog,
  type DatasetInfo,
  type Geography,
  type Indicator,
  indicatorCode,
  iso3,
  type SavedView,
  type Series,
  type SeriesPoint,
  type Settings,
  type Topic,
  year,
} from "../core/domain/model";
import { ok, type Result } from "../core/domain/result";

/** Builds a topic with sensible defaults. */
export function makeTopic(overrides: Partial<Topic> = {}): Topic {
  return {
    id: "economy",
    nameEn: "Economy & prices",
    nameEs: "Economía y precios",
    sortOrder: 1,
    ...overrides,
  };
}

/** Builds a geography with sensible defaults. */
export function makeGeography(overrides: Partial<Geography> = {}): Geography {
  return {
    iso3: iso3("ECU"),
    iso2: "EC",
    nameEn: "Ecuador",
    nameEs: "Ecuador",
    isAggregate: false,
    sortOrder: 1,
    ...overrides,
  };
}

/** Builds an indicator with sensible defaults. */
export function makeIndicator(overrides: Partial<Indicator> = {}): Indicator {
  return {
    code: indicatorCode("NY.GDP.MKTP.CD"),
    topicId: "economy",
    nameEn: "GDP (current US$)",
    nameEs: "PIB (US$ corrientes)",
    descriptionEn: "Gross domestic product in current prices.",
    descriptionEs: "Producto interno bruto a precios corrientes.",
    unitEn: "current US$",
    unitEs: "US$ corrientes",
    valueKind: "currency",
    decimals: 0,
    higherIs: "better",
    sourceOrgEn: "World Bank",
    sourceOrgEs: "Banco Mundial",
    sortOrder: 1,
    ...overrides,
  };
}

/** Builds a catalog holding two topics, two geographies and two indicators. */
export function makeCatalog(): Catalog {
  return {
    topics: [
      makeTopic(),
      makeTopic({
        id: "labour",
        nameEn: "Labour & poverty",
        nameEs: "Trabajo y pobreza",
        sortOrder: 3,
      }),
    ],
    geographies: [
      makeGeography(),
      makeGeography({
        iso3: iso3("COL"),
        iso2: "CO",
        nameEn: "Colombia",
        nameEs: "Colombia",
        sortOrder: 2,
      }),
    ],
    indicators: [
      makeIndicator(),
      makeIndicator({
        code: indicatorCode("FP.CPI.TOTL.ZG"),
        topicId: "economy",
        nameEn: "Inflation, consumer prices (annual %)",
        nameEs: "Inflación, precios al consumidor (% anual)",
        descriptionEn: "Inflation measured by the consumer price index.",
        descriptionEs: "Inflación medida por el índice de precios al consumidor.",
        unitEn: "% per year",
        unitEs: "% anual",
        valueKind: "percent",
        decimals: 1,
        higherIs: "worse",
        sortOrder: 5,
      }),
    ],
  };
}

/** Builds dataset provenance with the bundled snapshot counts. */
export function makeDatasetInfo(overrides: Partial<DatasetInfo> = {}): DatasetInfo {
  return {
    schemaVersion: 1,
    origin: "worldbank",
    datasetId: "ecuador-indicators",
    datasetVersion: "2026-11-20",
    sourceName: "World Development Indicators",
    sourcePublisher: "The World Bank",
    sourceLastUpdated: "2026-11-11",
    retrievedAt: "2026-11-20T07:17:18+00:00",
    license: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attributionEn: "Source: The World Bank.",
    attributionEs: "Fuente: Banco Mundial.",
    counts: { topics: 8, geographies: 7, indicators: 38, observations: 11780 },
    ...overrides,
  };
}

/** Builds a point list from `[year, value]` tuples. */
export function points(entries: readonly (readonly [number, number])[]): SeriesPoint[] {
  return entries.map(([valueYear, value]) => ({ year: year(valueYear), value }));
}

/** Builds a series for the default indicator/geography. */
export function makeSeries(
  entries: readonly (readonly [number, number])[],
  overrides: { indicator?: Indicator; geography?: Geography } = {},
): Series {
  return {
    indicator: overrides.indicator ?? makeIndicator(),
    geography: overrides.geography ?? makeGeography(),
    points: points(entries),
  };
}

/** Builds a saved view. */
export function makeSavedView(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: "view-1",
    name: "GDP in Ecuador",
    spec: {
      kind: "explore",
      indicator: indicatorCode("NY.GDP.MKTP.CD"),
      geographies: [iso3("ECU")],
      from: null,
      to: null,
      transform: "level",
      baseYear: null,
      chart: "line",
    },
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

/** Builds a settings document. */
export function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    theme: "system",
    language: "system",
    updateCheckEnabled: false,
    lastUpdateCheck: null,
    customSnapshotPath: null,
    ...overrides,
  };
}

/** Builds application metadata. */
export function makeAppInfo(overrides: Partial<AppInfo> = {}): AppInfo {
  return {
    version: "0.1.0",
    platform: "linux",
    dataDir: "/tmp/data",
    logDir: "/tmp/logs",
    ...overrides,
  };
}

/** A promise result already resolved as success. */
export function okAsync<T>(value: T): Promise<Result<T>> {
  return Promise.resolve(ok(value));
}
