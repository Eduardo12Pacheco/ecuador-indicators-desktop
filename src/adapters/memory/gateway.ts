/**
 * In-memory adapter used by the browser (dev), Playwright (`e2e`) and media
 * capture. It loads a JSON snapshot, mirrors the Rust services' validation and
 * persists views/settings in `localStorage`.
 *
 * The Tauri production build never includes this module: `bootstrap.ts` imports
 * it dynamically only when `VITE_ADAPTER=memory`.
 */

import { z } from "zod";

import type {
  AppPorts,
  ExportRequest,
  SettingsRepository,
  ViewRepository,
} from "../../core/application/ports";
import { catalogSchema, observationSchema } from "../../core/contracts/ipc";
import { appError } from "../../core/domain/errors";
import {
  type AppInfo,
  type Catalog,
  type DatasetInfo,
  indicatorCode,
  iso3,
  type Observation,
  type SavedView,
  type Settings,
  year,
} from "../../core/domain/model";
import { err, ok, type Result } from "../../core/domain/result";
import { MAX_VIEWS, validateViewName, validateViewSpec } from "../../core/domain/view";

const STORAGE_VIEWS = "ei:views";
const STORAGE_SETTINGS = "ei:settings";

/** The persistence surface the adapter needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The default settings document (S8). */
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  language: "system",
  updateCheckEnabled: false,
  lastUpdateCheck: null,
  customSnapshotPath: null,
};

const metaSchema = z.object({
  schema_version: z.string(),
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
});

const snapshotSchema = z.object({
  schema_version: z.number().int(),
  meta: metaSchema,
  topics: z.array(z.record(z.string(), z.unknown())),
  geographies: z.array(z.record(z.string(), z.unknown())),
  indicators: z.array(z.record(z.string(), z.unknown())),
  observations: z.array(z.tuple([z.string(), z.string(), z.number().int(), z.number()])),
});

type RawSnapshot = z.infer<typeof snapshotSchema>;

/** A stored view, persisted in the domain shape. */
const storedViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  spec: z.record(z.string(), z.unknown()),
  createdAt: z.number(),
  updatedAt: z.number(),
});

const storedViewsSchema = z.array(storedViewSchema);

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readJson(storage: StorageLike | null, key: string): unknown {
  if (storage === null) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJson(storage: StorageLike | null, key: string, value: unknown): void {
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // A full/denied localStorage must not break the app; state stays in memory.
  }
}

function toCatalog(raw: RawSnapshot): Catalog {
  const parsed = catalogSchema.parse({
    topics: raw.topics,
    geographies: raw.geographies,
    indicators: raw.indicators,
  });
  return {
    topics: parsed.topics.map((topic) => ({
      id: topic.id,
      nameEn: topic.name_en,
      nameEs: topic.name_es,
      sortOrder: topic.sort_order,
    })),
    geographies: parsed.geographies.map((geography) => ({
      iso3: iso3(geography.iso3),
      iso2: geography.iso2,
      nameEn: geography.name_en,
      nameEs: geography.name_es,
      isAggregate: geography.is_aggregate,
      sortOrder: geography.sort_order,
    })),
    indicators: parsed.indicators.map((indicator) => ({
      code: indicatorCode(indicator.code),
      topicId: indicator.topic_id,
      nameEn: indicator.name_en,
      nameEs: indicator.name_es,
      descriptionEn: indicator.description_en,
      descriptionEs: indicator.description_es,
      unitEn: indicator.unit_en,
      unitEs: indicator.unit_es,
      valueKind: indicator.value_kind,
      decimals: indicator.decimals,
      higherIs: indicator.higher_is,
      sourceOrgEn: indicator.source_org_en,
      sourceOrgEs: indicator.source_org_es,
      sortOrder: indicator.sort_order,
    })),
  };
}

function toInfo(raw: RawSnapshot): DatasetInfo {
  return {
    schemaVersion: raw.schema_version,
    origin: raw.meta.origin,
    datasetId: raw.meta.dataset_id,
    datasetVersion: raw.meta.dataset_version,
    sourceName: raw.meta.source_name,
    sourcePublisher: raw.meta.source_publisher,
    sourceLastUpdated: raw.meta.source_last_updated,
    retrievedAt: raw.meta.retrieved_at,
    license: raw.meta.license,
    licenseUrl: raw.meta.license_url,
    attributionEn: raw.meta.attribution_en,
    attributionEs: raw.meta.attribution_es,
    counts: {
      topics: raw.topics.length,
      geographies: raw.geographies.length,
      indicators: raw.indicators.length,
      observations: raw.observations.length,
    },
  };
}

function toObservations(raw: RawSnapshot): Observation[] {
  return raw.observations.map(([code, geography, yearValue, value]) => {
    const parsed = observationSchema.parse({
      indicator_code: code,
      iso3: geography,
      year: yearValue,
      value,
    });
    return {
      indicatorCode: indicatorCode(parsed.indicator_code),
      iso3: iso3(parsed.iso3),
      year: year(parsed.year),
      value: parsed.value,
    };
  });
}

async function loadSnapshot(): Promise<unknown> {
  if (import.meta.env.MODE === "e2e" || import.meta.env.MODE === "capture") {
    const response = await fetch("/__fixture__/snapshot.json");
    if (!response.ok) {
      throw new Error(`fixture request failed with ${response.status}`);
    }
    return response.json();
  }
  const module = await import("./fixtures/mini.snapshot.json");
  return module.default;
}

/** Options for the in-memory adapter (all injectable for tests). */
export interface MemoryGatewayOptions {
  readonly storage?: StorageLike | null;
  readonly now?: () => number;
  readonly id?: () => string;
  readonly snapshot?: unknown;
  readonly download?: (request: ExportRequest) => Result<string>;
}

/** Default download used in the browser. */
function browserDownload(request: ExportRequest): Result<string> {
  try {
    const blob = new Blob([request.content as BlobPart], {
      type: request.kind === "csv" ? "text/csv;charset=utf-8" : "image/png",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = request.suggestedName;
    anchor.click();
    URL.revokeObjectURL(url);
    return ok("download");
  } catch (error) {
    return err(appError("EXPORT_REJECTED", "the browser rejected the download", String(error)));
  }
}

/** Builds the in-memory ports. */
export async function createMemoryGateway(options: MemoryGatewayOptions = {}): Promise<AppPorts> {
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const newId =
    options.id ??
    (() => {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
      return `view-${now()}-${Math.random().toString(36).slice(2)}`;
    });
  const raw = snapshotSchema.parse(options.snapshot ?? (await loadSnapshot()));
  const catalog = toCatalog(raw);
  const observations = toObservations(raw);
  const info = toInfo(raw);
  const bundledInfo = info;

  const storedViews = storedViewsSchema.safeParse(readJson(storage, STORAGE_VIEWS));
  let views: SavedView[] = storedViews.success ? (storedViews.data as SavedView[]) : [];
  const storedSettings = readJson(storage, STORAGE_SETTINGS);
  let settings: Settings =
    storedSettings === null
      ? DEFAULT_SETTINGS
      : { ...DEFAULT_SETTINGS, ...(storedSettings as Partial<Settings>) };

  function persistViews(): void {
    writeJson(storage, STORAGE_VIEWS, views);
  }

  const viewRepository: ViewRepository = {
    async list() {
      return ok([...views].sort((left, right) => right.updatedAt - left.updatedAt));
    },
    async create(view) {
      const name = view.name.trim();
      const nameCheck = validateViewName(name);
      if (!nameCheck.ok) {
        return nameCheck;
      }
      const specCheck = validateViewSpec(view.spec);
      if (!specCheck.ok) {
        return specCheck;
      }
      if (views.length >= MAX_VIEWS) {
        return err(appError("LIMIT_EXCEEDED", `at most ${MAX_VIEWS} saved views are allowed`));
      }
      const timestamp = now();
      const saved: SavedView = {
        id: newId(),
        name,
        spec: view.spec,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      views = [...views, saved];
      persistViews();
      return ok(saved);
    },
    async update(id, view) {
      const existing = views.find((candidate) => candidate.id === id);
      if (existing === undefined) {
        return err(appError("VIEW_NOT_FOUND", `saved view ${id} was not found`));
      }
      const name = view.name.trim();
      const nameCheck = validateViewName(name);
      if (!nameCheck.ok) {
        return nameCheck;
      }
      const specCheck = validateViewSpec(view.spec);
      if (!specCheck.ok) {
        return specCheck;
      }
      const saved: SavedView = {
        id: existing.id,
        name,
        spec: view.spec,
        createdAt: existing.createdAt,
        updatedAt: now(),
      };
      views = views.map((candidate) => (candidate.id === id ? saved : candidate));
      persistViews();
      return ok(saved);
    },
    async remove(id) {
      const existing = views.find((candidate) => candidate.id === id);
      if (existing === undefined) {
        return err(appError("VIEW_NOT_FOUND", `saved view ${id} was not found`));
      }
      views = views.filter((candidate) => candidate.id !== id);
      persistViews();
      return ok(undefined);
    },
  };

  const settingsRepository: SettingsRepository = {
    async get() {
      return ok({ ...settings });
    },
    async set(document) {
      settings = { ...document };
      writeJson(storage, STORAGE_SETTINGS, settings);
      return ok(undefined);
    },
  };

  const appInfo: AppInfo = {
    version: "0.1.0",
    platform: "web",
    dataDir: "",
    logDir: "",
  };

  return {
    dataset: {
      async getInfo() {
        return ok(info);
      },
      async getCatalog() {
        return ok(catalog);
      },
      async getObservations(codes, iso3s) {
        const codeSet = new Set(codes);
        const geographySet = new Set(iso3s);
        return ok(
          observations.filter(
            (observation) =>
              codeSet.has(observation.indicatorCode) && geographySet.has(observation.iso3),
          ),
        );
      },
      async openSnapshot() {
        return err(
          appError(
            "INVALID_INPUT",
            "custom snapshots are only available in the desktop application",
          ),
        );
      },
      async resetSnapshot() {
        return ok(bundledInfo);
      },
    },
    views: viewRepository,
    settings: settingsRepository,
    export: {
      async save(request) {
        return (options.download ?? browserDownload)(request);
      },
    },
    updates: {
      async check() {
        return ok({ kind: "disabled", current: appInfo.version });
      },
    },
    appInfo: {
      async get() {
        return ok(appInfo);
      },
    },
  };
}
