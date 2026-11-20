import { describe, expect, it } from "vitest";

import {
  appInfoSchema,
  catalogSchema,
  datasetInfoSchema,
  errorDtoSchema,
  indicatorSchema,
  ipcSchemas,
  newViewSchema,
  observationSchema,
  savedViewSchema,
  settingsSchema,
  updateStatusSchema,
  viewSpecSchema,
} from "./ipc";

const wireIndicator = {
  code: "NY.GDP.MKTP.CD",
  topic_id: "economy",
  name_en: "GDP",
  name_es: "PIB",
  description_en: "d",
  description_es: "d",
  unit_en: "u",
  unit_es: "u",
  value_kind: "currency",
  decimals: 0,
  higher_is: "better",
  source_org_en: "s",
  source_org_es: "s",
  sort_order: 1,
};

const wireCatalog = {
  topics: [{ id: "economy", name_en: "Economy", name_es: "Economía", sort_order: 1 }],
  geographies: [
    {
      iso3: "ECU",
      iso2: "EC",
      name_en: "Ecuador",
      name_es: "Ecuador",
      is_aggregate: false,
      sort_order: 1,
    },
  ],
  indicators: [wireIndicator],
};

describe("IPC contracts", () => {
  it("accepts a well-formed catalog", () => {
    expect(catalogSchema.parse(wireCatalog).indicators[0]?.code).toBe("NY.GDP.MKTP.CD");
  });

  it("rejects malformed payloads", () => {
    expect(catalogSchema.safeParse({ topics: [] }).success).toBe(false);
    expect(indicatorSchema.safeParse({ ...wireIndicator, value_kind: "bogus" }).success).toBe(
      false,
    );
    expect(indicatorSchema.safeParse({ ...wireIndicator, decimals: "0" }).success).toBe(false);
    expect(datasetInfoSchema.safeParse({ counts: {} }).success).toBe(false);
    expect(
      observationSchema.safeParse({ indicator_code: "X", iso3: "ECU", year: 2020 }).success,
    ).toBe(false);
    expect(errorDtoSchema.safeParse({ code: 1 }).success).toBe(false);
    expect(appInfoSchema.safeParse({ version: "1" }).success).toBe(false);
  });

  it("validates every view spec variant", () => {
    expect(
      viewSpecSchema.safeParse({
        kind: "explore",
        indicator: "X",
        geographies: ["ECU"],
        from: null,
        to: null,
        transform: "level",
        base_year: null,
        chart: "line",
      }).success,
    ).toBe(true);
    expect(
      viewSpecSchema.safeParse({
        kind: "trajectories",
        indicators: ["A", "B"],
        geography: "ECU",
        base_year: 2020,
      }).success,
    ).toBe(true);
    expect(viewSpecSchema.safeParse({ kind: "ranking", indicator: "X", year: 2020 }).success).toBe(
      true,
    );
    expect(viewSpecSchema.safeParse({ kind: "unknown" }).success).toBe(false);
    expect(
      viewSpecSchema.safeParse({
        kind: "explore",
        indicator: "X",
        geographies: ["ECU"],
        from: null,
        to: null,
        transform: "bogus",
        base_year: null,
        chart: "line",
      }).success,
    ).toBe(false);
  });

  it("validates saved views, new views, settings and update status", () => {
    const spec = { kind: "ranking", indicator: "X", year: 2020 };
    expect(
      savedViewSchema.safeParse({ id: "1", name: "n", spec, created_at: 1, updated_at: 2 }).success,
    ).toBe(true);
    expect(newViewSchema.safeParse({ name: "n", spec }).success).toBe(true);
    expect(
      settingsSchema.safeParse({
        theme: "system",
        language: "en",
        update_check_enabled: false,
        last_update_check: null,
        custom_snapshot_path: null,
      }).success,
    ).toBe(true);
    expect(
      settingsSchema.safeParse({
        theme: "neon",
        language: "en",
        update_check_enabled: false,
        last_update_check: null,
        custom_snapshot_path: null,
      }).success,
    ).toBe(false);
    expect(updateStatusSchema.safeParse({ kind: "disabled", current: "0.1.0" }).success).toBe(true);
    expect(
      updateStatusSchema.safeParse({
        kind: "available",
        current: "0.1.0",
        latest: "0.2.0",
        url: "https://example.test",
        published_at: null,
      }).success,
    ).toBe(true);
    expect(updateStatusSchema.safeParse({ kind: "disabled" }).success).toBe(false);
  });

  it("exposes a schema for every IPC command", () => {
    expect(Object.keys(ipcSchemas).sort()).toEqual(
      [
        "app_info",
        "dataset_catalog",
        "dataset_info",
        "dataset_observations",
        "dataset_open_snapshot",
        "dataset_reset_snapshot",
        "export_save",
        "settings_get",
        "settings_set",
        "updates_check",
        "views_create",
        "views_delete",
        "views_list",
        "views_update",
      ].sort(),
    );
  });
});
