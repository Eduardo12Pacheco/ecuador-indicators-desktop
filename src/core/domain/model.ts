/**
 * Domain model of the application.
 *
 * These are the TypeScript core's own types, deliberately not the Rust wire
 * DTOs: `src/adapters/tauri/mappers.ts` maps generated bindings into this
 * branded model (ADR 0003), so the core never depends on the IPC contract.
 */

/** Nominal wrapper used to keep raw strings out of branded positions. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/** A World Bank indicator code such as `NY.GDP.MKTP.CD`. */
export type IndicatorCode = Brand<string, "IndicatorCode">;
/** An ISO 3166-1 alpha-3 geography code such as `ECU`. */
export type Iso3 = Brand<string, "Iso3">;
/** A calendar year. */
export type Year = Brand<number, "Year">;

/** Casts a trusted indicator code (from a validated snapshot) to the brand. */
export function indicatorCode(value: string): IndicatorCode {
  return value as IndicatorCode;
}

/** Casts a trusted ISO3 code (from a validated snapshot) to the brand. */
export function iso3(value: string): Iso3 {
  return value as Iso3;
}

/** Casts a trusted calendar year to the brand. */
export function year(value: number): Year {
  return value as Year;
}

/** True for uppercase eight-bit ISO3 codes. */
export function isIso3(value: string): value is Iso3 {
  return /^[A-Z]{3}$/.test(value);
}

/** True for the years accepted by every persisted view range (1900..=2100). */
export function isYear(value: number): value is Year {
  return Number.isInteger(value) && value >= 1900 && value <= 2100;
}

/** Unit family used for formatting and chart labels. */
export type ValueKind = "currency" | "percent" | "number" | "years" | "rate" | "index";

/** Whether a higher value is desirable, used for KPI delta semantics. */
export type HigherIs = "better" | "worse" | "neutral";

/** Transform applied to a series before charting or tabulating. */
export type Transform = "level" | "yoy" | "index";

/** Chart type selected in the Explore page. */
export type ChartKind = "line" | "area" | "bar";

/** Active UI language. */
export type Lang = "en" | "es";

/** Theme preference. */
export type ThemePref = "system" | "light" | "dark";

/** Language preference. */
export type LangPref = "system" | "en" | "es";

/** A catalog topic (for example `economy`). */
export interface Topic {
  readonly id: string;
  readonly nameEn: string;
  readonly nameEs: string;
  readonly sortOrder: number;
}

/** A geography included in the snapshot. */
export interface Geography {
  readonly iso3: Iso3;
  readonly iso2: string;
  readonly nameEn: string;
  readonly nameEs: string;
  readonly isAggregate: boolean;
  readonly sortOrder: number;
}

/** A curated indicator with bilingual metadata. */
export interface Indicator {
  readonly code: IndicatorCode;
  readonly topicId: string;
  readonly nameEn: string;
  readonly nameEs: string;
  readonly descriptionEn: string;
  readonly descriptionEs: string;
  readonly unitEn: string;
  readonly unitEs: string;
  readonly valueKind: ValueKind;
  readonly decimals: number;
  readonly higherIs: HigherIs;
  readonly sourceOrgEn: string;
  readonly sourceOrgEs: string;
  readonly sortOrder: number;
}

/** The complete catalog in curated sort order. */
export interface Catalog {
  readonly topics: readonly Topic[];
  readonly geographies: readonly Geography[];
  readonly indicators: readonly Indicator[];
}

/** Per-table row counts exposed by the bundled snapshot. */
export interface DatasetCounts {
  readonly topics: number;
  readonly geographies: number;
  readonly indicators: number;
  readonly observations: number;
}

/** Provenance and shape of the active snapshot. */
export interface DatasetInfo {
  readonly schemaVersion: number;
  readonly origin: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly sourceName: string;
  readonly sourcePublisher: string;
  readonly sourceLastUpdated: string;
  readonly retrievedAt: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly attributionEn: string;
  readonly attributionEs: string;
  readonly counts: DatasetCounts;
}

/** One annual observation. */
export interface Observation {
  readonly indicatorCode: IndicatorCode;
  readonly iso3: Iso3;
  readonly year: Year;
  readonly value: number;
}

/** A point of a time series. */
export interface SeriesPoint {
  readonly year: Year;
  readonly value: number;
}

/** One geography's series for one indicator. */
export interface Series {
  readonly indicator: Indicator;
  readonly geography: Geography;
  readonly points: readonly SeriesPoint[];
}

/** A persistable page state (mirrors D25). */
export type ViewSpec =
  | {
      readonly kind: "explore";
      readonly indicator: IndicatorCode;
      readonly geographies: readonly Iso3[];
      readonly from: Year | null;
      readonly to: Year | null;
      readonly transform: Transform;
      readonly baseYear: Year | null;
      readonly chart: ChartKind;
    }
  | {
      readonly kind: "trajectories";
      readonly indicators: readonly IndicatorCode[];
      readonly geography: Iso3;
      readonly baseYear: Year | null;
    }
  | { readonly kind: "ranking"; readonly indicator: IndicatorCode; readonly year: Year };

/** A persisted saved view. */
export interface SavedView {
  readonly id: string;
  readonly name: string;
  readonly spec: ViewSpec;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** The payload accepted when creating or updating a view. */
export interface NewView {
  readonly name: string;
  readonly spec: ViewSpec;
}

/** The complete settings document. */
export interface Settings {
  readonly theme: ThemePref;
  readonly language: LangPref;
  readonly updateCheckEnabled: boolean;
  /** Unix timestamp (seconds) of the last successful update check. */
  readonly lastUpdateCheck: number | null;
  readonly customSnapshotPath: string | null;
}

/** Result of one update check. */
export type UpdateStatus =
  | { readonly kind: "up_to_date"; readonly current: string }
  | {
      readonly kind: "available";
      readonly current: string;
      readonly latest: string;
      readonly url: string;
      readonly publishedAt: string | null;
    }
  | { readonly kind: "disabled"; readonly current: string };

/** Read-only application metadata shown by About and Settings. */
export interface AppInfo {
  readonly version: string;
  readonly platform: string;
  readonly dataDir: string;
  readonly logDir: string;
}

/** Returns the localized display name of a topic. */
export function topicName(topic: Topic, lang: Lang): string {
  return lang === "es" ? topic.nameEs : topic.nameEn;
}

/**
 * Returns the localized display name of a geography.
 *
 * The World Bank API returns some names with trailing whitespace (for example
 * "Latin America & Caribbean "); the raw cache keeps them verbatim, so the
 * display layer trims them.
 */
export function geographyName(geography: Geography, lang: Lang): string {
  return (lang === "es" ? geography.nameEs : geography.nameEn).trim();
}

/** Returns the localized display name of an indicator. */
export function indicatorName(indicator: Indicator, lang: Lang): string {
  return lang === "es" ? indicator.nameEs : indicator.nameEn;
}

/** Returns the localized unit label of an indicator. */
export function indicatorUnit(indicator: Indicator, lang: Lang): string {
  return lang === "es" ? indicator.unitEs : indicator.unitEn;
}

/** Finds an indicator by code. */
export function findIndicator(catalog: Catalog, code: string): Indicator | undefined {
  return catalog.indicators.find((indicator) => indicator.code === code);
}

/** Finds a geography by ISO3 code. */
export function findGeography(catalog: Catalog, code: string): Geography | undefined {
  return catalog.geographies.find((geography) => geography.iso3 === code);
}

/** Finds a topic by id. */
export function findTopic(catalog: Catalog, id: string): Topic | undefined {
  return catalog.topics.find((topic) => topic.id === id);
}
