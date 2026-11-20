/**
 * Zod schemas for every IPC payload (S24).
 *
 * Each schema is statically checked against the ts-rs generated binding with
 * `satisfies z.ZodType<...>`, so a Rust wire-type change fails `tsc` until the
 * contract is updated (the bindings themselves are guarded by
 * `npm run check:bindings`).
 */

import { z } from "zod";

import type { AppInfo } from "../../adapters/tauri/generated/AppInfo";
import type { Catalog } from "../../adapters/tauri/generated/Catalog";
import type { DatasetInfo } from "../../adapters/tauri/generated/DatasetInfo";
import type { ErrorDto } from "../../adapters/tauri/generated/ErrorDto";
import type { Geography } from "../../adapters/tauri/generated/Geography";
import type { Indicator } from "../../adapters/tauri/generated/Indicator";
import type { NewView } from "../../adapters/tauri/generated/NewView";
import type { Observation } from "../../adapters/tauri/generated/Observation";
import type { SavedView } from "../../adapters/tauri/generated/SavedView";
import type { Settings } from "../../adapters/tauri/generated/Settings";
import type { Topic } from "../../adapters/tauri/generated/Topic";
import type { UpdateStatus } from "../../adapters/tauri/generated/UpdateStatus";
import type { ViewSpec } from "../../adapters/tauri/generated/ViewSpec";

/** A catalog topic. */
export const topicSchema = z.object({
  id: z.string(),
  name_en: z.string(),
  name_es: z.string(),
  sort_order: z.number().int(),
}) satisfies z.ZodType<Topic>;

/** A geography. */
export const geographySchema = z.object({
  iso3: z.string(),
  iso2: z.string(),
  name_en: z.string(),
  name_es: z.string(),
  is_aggregate: z.boolean(),
  sort_order: z.number().int(),
}) satisfies z.ZodType<Geography>;

/** A curated indicator. */
export const indicatorSchema = z.object({
  code: z.string(),
  topic_id: z.string(),
  name_en: z.string(),
  name_es: z.string(),
  description_en: z.string(),
  description_es: z.string(),
  unit_en: z.string(),
  unit_es: z.string(),
  value_kind: z.enum(["currency", "percent", "number", "years", "rate", "index"]),
  decimals: z.number().int(),
  higher_is: z.enum(["better", "worse", "neutral"]),
  source_org_en: z.string(),
  source_org_es: z.string(),
  sort_order: z.number().int(),
}) satisfies z.ZodType<Indicator>;

/** The complete catalog. */
export const catalogSchema = z.object({
  topics: z.array(topicSchema),
  geographies: z.array(geographySchema),
  indicators: z.array(indicatorSchema),
}) satisfies z.ZodType<Catalog>;

/** Snapshot counts. */
export const datasetCountsSchema = z.object({
  topics: z.number().int(),
  geographies: z.number().int(),
  indicators: z.number().int(),
  observations: z.number().int(),
});

/** Snapshot provenance. */
export const datasetInfoSchema = z.object({
  schema_version: z.number().int(),
  origin: z.string(),
  dataset_id: z.string(),
  dataset_version: z.string(),
  source_name: z.string(),
  source_publisher: z.string(),
  source_last_updated: z.string(),
  retrieved_at: z.string(),
  license: z.string(),
  license_url: z.string(),
  attribution_en: z.string(),
  attribution_es: z.string(),
  counts: datasetCountsSchema,
}) satisfies z.ZodType<DatasetInfo>;

/** One observation. */
export const observationSchema = z.object({
  indicator_code: z.string(),
  iso3: z.string(),
  year: z.number().int(),
  value: z.number(),
}) satisfies z.ZodType<Observation>;

/** The persisted view spec tagged union (D25). */
export const viewSpecSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("explore"),
    indicator: z.string(),
    geographies: z.array(z.string()),
    from: z.number().int().nullable(),
    to: z.number().int().nullable(),
    transform: z.enum(["level", "yoy", "index"]),
    base_year: z.number().int().nullable(),
    chart: z.enum(["line", "area", "bar"]),
  }),
  z.object({
    kind: z.literal("trajectories"),
    indicators: z.array(z.string()),
    geography: z.string(),
    base_year: z.number().int().nullable(),
  }),
  z.object({
    kind: z.literal("ranking"),
    indicator: z.string(),
    year: z.number().int(),
  }),
]) satisfies z.ZodType<ViewSpec>;

/** A persisted view. */
export const savedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  spec: viewSpecSchema,
  created_at: z.number().int(),
  updated_at: z.number().int(),
}) satisfies z.ZodType<SavedView>;

/** The create/update payload. */
export const newViewSchema = z.object({
  name: z.string(),
  spec: viewSpecSchema,
}) satisfies z.ZodType<NewView>;

/** The settings document. */
export const settingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]),
  language: z.enum(["system", "en", "es"]),
  update_check_enabled: z.boolean(),
  last_update_check: z.number().int().nullable(),
  custom_snapshot_path: z.string().nullable(),
}) satisfies z.ZodType<Settings>;

/** The update-check result union. */
export const updateStatusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("up_to_date"), current: z.string() }),
  z.object({
    kind: z.literal("available"),
    current: z.string(),
    latest: z.string(),
    url: z.string(),
    published_at: z.string().nullable(),
  }),
  z.object({ kind: z.literal("disabled"), current: z.string() }),
]) satisfies z.ZodType<UpdateStatus>;

/** Read-only application metadata. */
export const appInfoSchema = z.object({
  version: z.string(),
  platform: z.string(),
  data_dir: z.string(),
  log_dir: z.string(),
}) satisfies z.ZodType<AppInfo>;

/** The IPC error shape. */
export const errorDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
}) satisfies z.ZodType<ErrorDto>;

/** The `[T]` payloads returned by each command. */
export const ipcSchemas = {
  app_info: appInfoSchema,
  dataset_info: datasetInfoSchema,
  dataset_catalog: catalogSchema,
  dataset_observations: z.array(observationSchema) satisfies z.ZodType<Observation[]>,
  dataset_open_snapshot: datasetInfoSchema,
  dataset_reset_snapshot: datasetInfoSchema,
  views_list: z.array(savedViewSchema) satisfies z.ZodType<SavedView[]>,
  views_create: savedViewSchema,
  views_update: savedViewSchema,
  views_delete: z.null(),
  settings_get: settingsSchema,
  settings_set: z.null(),
  export_save: z.string(),
  updates_check: updateStatusSchema,
} as const;
