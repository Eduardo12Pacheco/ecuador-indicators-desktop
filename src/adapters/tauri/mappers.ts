/**
 * Anti-corruption layer between the ts-rs wire DTOs (snake_case, plain strings)
 * and the TypeScript core's branded, camelCase domain model (ADR 0003).
 */

import {
  type AppInfo,
  type Catalog,
  type ChartKind,
  type DatasetInfo,
  type Geography,
  type Indicator,
  indicatorCode,
  iso3,
  type LangPref,
  type NewView,
  type Observation,
  type SavedView,
  type Settings,
  type ThemePref,
  type Topic,
  type Transform,
  type UpdateStatus,
  type ViewSpec,
  year,
} from "../../core/domain/model";
import type { AppInfo as WireAppInfo } from "./generated/AppInfo";
import type { Catalog as WireCatalog } from "./generated/Catalog";
import type { DatasetInfo as WireDatasetInfo } from "./generated/DatasetInfo";
import type { Geography as WireGeography } from "./generated/Geography";
import type { Indicator as WireIndicator } from "./generated/Indicator";
import type { NewView as WireNewView } from "./generated/NewView";
import type { Observation as WireObservation } from "./generated/Observation";
import type { SavedView as WireSavedView } from "./generated/SavedView";
import type { Settings as WireSettings } from "./generated/Settings";
import type { Topic as WireTopic } from "./generated/Topic";
import type { UpdateStatus as WireUpdateStatus } from "./generated/UpdateStatus";
import type { ViewSpec as WireViewSpec } from "./generated/ViewSpec";

function toIso3(value: string) {
  return iso3(value);
}

/** Maps a wire topic. */
export function mapTopic(topic: WireTopic): Topic {
  return {
    id: topic.id,
    nameEn: topic.name_en,
    nameEs: topic.name_es,
    sortOrder: topic.sort_order,
  };
}

/** Maps a wire geography. */
export function mapGeography(geography: WireGeography): Geography {
  return {
    iso3: toIso3(geography.iso3),
    iso2: geography.iso2,
    nameEn: geography.name_en,
    nameEs: geography.name_es,
    isAggregate: geography.is_aggregate,
    sortOrder: geography.sort_order,
  };
}

/** Maps a wire indicator. */
export function mapIndicator(indicator: WireIndicator): Indicator {
  return {
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
  };
}

/** Maps the complete catalog. */
export function mapCatalog(catalog: WireCatalog): Catalog {
  return {
    topics: catalog.topics.map(mapTopic),
    geographies: catalog.geographies.map(mapGeography),
    indicators: catalog.indicators.map(mapIndicator),
  };
}

/** Maps snapshot provenance. */
export function mapDatasetInfo(info: WireDatasetInfo): DatasetInfo {
  return {
    schemaVersion: info.schema_version,
    origin: info.origin,
    datasetId: info.dataset_id,
    datasetVersion: info.dataset_version,
    sourceName: info.source_name,
    sourcePublisher: info.source_publisher,
    sourceLastUpdated: info.source_last_updated,
    retrievedAt: info.retrieved_at,
    license: info.license,
    licenseUrl: info.license_url,
    attributionEn: info.attribution_en,
    attributionEs: info.attribution_es,
    counts: {
      topics: info.counts.topics,
      geographies: info.counts.geographies,
      indicators: info.counts.indicators,
      observations: info.counts.observations,
    },
  };
}

/** Maps one observation. */
export function mapObservation(observation: WireObservation): Observation {
  return {
    indicatorCode: indicatorCode(observation.indicator_code),
    iso3: toIso3(observation.iso3),
    year: year(observation.year),
    value: observation.value,
  };
}

/** Maps a persisted view spec into the branded union. */
export function mapViewSpec(spec: WireViewSpec): ViewSpec {
  switch (spec.kind) {
    case "explore":
      return {
        kind: "explore",
        indicator: indicatorCode(spec.indicator),
        geographies: spec.geographies.map(iso3),
        from: spec.from === null ? null : year(spec.from),
        to: spec.to === null ? null : year(spec.to),
        transform: spec.transform as Transform,
        baseYear: spec.base_year === null ? null : year(spec.base_year),
        chart: spec.chart as ChartKind,
      };
    case "trajectories":
      return {
        kind: "trajectories",
        indicators: spec.indicators.map(indicatorCode),
        geography: iso3(spec.geography),
        baseYear: spec.base_year === null ? null : year(spec.base_year),
      };
    case "ranking":
      return {
        kind: "ranking",
        indicator: indicatorCode(spec.indicator),
        year: year(spec.year),
      };
  }
}

/** Maps a persisted view. */
export function mapSavedView(view: WireSavedView): SavedView {
  return {
    id: view.id,
    name: view.name,
    spec: mapViewSpec(view.spec),
    createdAt: view.created_at,
    updatedAt: view.updated_at,
  };
}

/** Maps the settings document. */
export function mapSettings(settings: WireSettings): Settings {
  return {
    theme: settings.theme as ThemePref,
    language: settings.language as LangPref,
    updateCheckEnabled: settings.update_check_enabled,
    lastUpdateCheck: settings.last_update_check,
    customSnapshotPath: settings.custom_snapshot_path,
  };
}

/** Maps the update result union. */
export function mapUpdateStatus(status: WireUpdateStatus): UpdateStatus {
  switch (status.kind) {
    case "up_to_date":
      return { kind: "up_to_date", current: status.current };
    case "available":
      return {
        kind: "available",
        current: status.current,
        latest: status.latest,
        url: status.url,
        publishedAt: status.published_at,
      };
    case "disabled":
      return { kind: "disabled", current: status.current };
  }
}

/** Maps read-only application metadata. */
export function mapAppInfo(info: WireAppInfo): AppInfo {
  return {
    version: info.version,
    platform: info.platform,
    dataDir: info.data_dir,
    logDir: info.log_dir,
  };
}

/** Converts a domain spec back into the wire union for create/update calls. */
export function viewSpecToWire(spec: ViewSpec): WireViewSpec {
  switch (spec.kind) {
    case "explore":
      return {
        kind: "explore",
        indicator: spec.indicator,
        geographies: [...spec.geographies],
        from: spec.from,
        to: spec.to,
        transform: spec.transform,
        base_year: spec.baseYear,
        chart: spec.chart,
      };
    case "trajectories":
      return {
        kind: "trajectories",
        indicators: [...spec.indicators],
        geography: spec.geography,
        base_year: spec.baseYear,
      };
    case "ranking":
      return { kind: "ranking", indicator: spec.indicator, year: spec.year };
  }
}

/** Converts a domain create/update payload into the wire payload. */
export function newViewToWire(view: NewView): WireNewView {
  return { name: view.name, spec: viewSpecToWire(view.spec) };
}

/** Converts the domain settings document into the wire payload. */
export function settingsToWire(settings: Settings): WireSettings {
  return {
    theme: settings.theme,
    language: settings.language,
    update_check_enabled: settings.updateCheckEnabled,
    last_update_check: settings.lastUpdateCheck,
    custom_snapshot_path: settings.customSnapshotPath,
  };
}
