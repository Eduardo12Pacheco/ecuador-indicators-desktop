import { describe, expect, it } from "vitest";
import { indicatorCode, type NewView, year } from "../../core/domain/model";
import { createTauriGateway, type InvokeFn, toAppError } from "./gateway";
import { viewSpecToWire } from "./mappers";

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
  indicators: [
    {
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
    },
  ],
};

const wireInfo = {
  schema_version: 1,
  origin: "worldbank",
  dataset_id: "id",
  dataset_version: "v",
  source_name: "n",
  source_publisher: "p",
  source_last_updated: "d",
  retrieved_at: "r",
  license: "CC-BY-4.0",
  license_url: "u",
  attribution_en: "a",
  attribution_es: "a",
  counts: { topics: 8, geographies: 7, indicators: 38, observations: 11780 },
};

const wireSpec = viewSpecToWire({
  kind: "ranking",
  indicator: indicatorCode("X"),
  year: year(2020),
});

const wireView = {
  id: "v1",
  name: "View",
  spec: wireSpec,
  created_at: 1,
  updated_at: 2,
};

const wireSettings = {
  theme: "system",
  language: "en",
  update_check_enabled: false,
  last_update_check: null,
  custom_snapshot_path: null,
};

interface Harness {
  readonly gateway: ReturnType<typeof createTauriGateway>;
  readonly calls: Array<{ command: string; args: Record<string, unknown> | undefined }>;
}

function harness(responses: Record<string, unknown>): Harness {
  const calls: Harness["calls"] = [];
  const invoke: InvokeFn = async (command, args) => {
    calls.push({ command, args });
    if (!(command in responses)) {
      throw new Error(`unexpected command ${command}`);
    }
    return responses[command];
  };
  return { gateway: createTauriGateway(invoke), calls };
}

const newView: NewView = {
  name: "View",
  spec: { kind: "ranking", indicator: "X" as never, year: 2020 as never },
};

describe("Tauri gateway", () => {
  it("maps every read command", async () => {
    const { gateway, calls } = harness({
      dataset_info: wireInfo,
      dataset_catalog: wireCatalog,
      dataset_observations: [{ indicator_code: "X", iso3: "ECU", year: 2020, value: 1 }],
      views_list: [wireView],
      settings_get: wireSettings,
      app_info: { version: "0.1.0", platform: "linux", data_dir: "/d", log_dir: "/l" },
      updates_check: { kind: "disabled", current: "0.1.0" },
    });
    expect((await gateway.dataset.getInfo()).ok).toBe(true);
    expect((await gateway.dataset.getCatalog()).ok).toBe(true);
    const observations = await gateway.dataset.getObservations(["X"], ["ECU"]);
    expect(observations.ok && observations.value[0]?.year).toBe(2020);
    expect((await gateway.views.list()).ok).toBe(true);
    expect((await gateway.settings.get()).ok).toBe(true);
    expect((await gateway.appInfo.get()).ok).toBe(true);
    expect(await gateway.updates.check(true)).toEqual({
      ok: true,
      value: { kind: "disabled", current: "0.1.0" },
    });
    expect(calls.map((call) => call.command)).toEqual([
      "dataset_info",
      "dataset_catalog",
      "dataset_observations",
      "views_list",
      "settings_get",
      "app_info",
      "updates_check",
    ]);
    expect(calls[2]?.args).toEqual({ codes: ["X"], iso3s: ["ECU"] });
    expect(calls[6]?.args).toEqual({ force: true });
  });

  it("maps open/reset, view writes and settings writes", async () => {
    const { gateway, calls } = harness({
      dataset_open_snapshot: wireInfo,
      dataset_reset_snapshot: wireInfo,
      views_create: wireView,
      views_update: wireView,
      views_delete: null,
      settings_set: null,
    });
    expect((await gateway.dataset.openSnapshot("/tmp/x.sqlite")).ok).toBe(true);
    expect((await gateway.dataset.resetSnapshot()).ok).toBe(true);
    expect((await gateway.views.create(newView)).ok).toBe(true);
    expect((await gateway.views.update("v1", newView)).ok).toBe(true);
    expect((await gateway.views.remove("v1")).ok).toBe(true);
    expect(
      (
        await gateway.settings.set({
          theme: "dark",
          language: "es",
          updateCheckEnabled: true,
          lastUpdateCheck: 5,
          customSnapshotPath: null,
        })
      ).ok,
    ).toBe(true);
    expect(calls[0]?.args).toEqual({ path: "/tmp/x.sqlite" });
    expect(calls[2]?.args).toEqual({ view: { name: "View", spec: wireSpec } });
    expect(calls[3]?.args).toEqual({ id: "v1", view: { name: "View", spec: wireSpec } });
    expect(calls[5]?.args).toMatchObject({
      settings: { theme: "dark", language: "es", update_check_enabled: true },
    });
  });

  it("reports that native export saving is not wired yet", async () => {
    const { gateway } = harness({});
    const result = await gateway.export.save({
      suggestedName: "x.csv",
      kind: "csv",
      content: "a",
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
  });

  it("maps typed ErrorDto failures and unknown thrown values", async () => {
    const gateway = createTauriGateway(async () => {
      throw { code: "SNAPSHOT_INVALID", message: "bad file" };
    });
    expect(await gateway.dataset.getInfo()).toEqual({
      ok: false,
      error: { code: "SNAPSHOT_INVALID", message: "bad file" },
    });

    const unknownCode = createTauriGateway(async () => {
      throw { code: "WEIRD", message: "x" };
    });
    expect(await unknownCode.dataset.getInfo()).toEqual({
      ok: false,
      error: { code: "INTERNAL", message: "x" },
    });
  });

  it("rejects malformed payloads with INTERNAL and details", async () => {
    const { gateway } = harness({ dataset_catalog: { topics: [] } });
    const result = await gateway.dataset.getCatalog();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL");
      expect(result.error.details).toBeTruthy();
    }
  });

  it("normalizes thrown values", () => {
    expect(toAppError({ code: "NETWORK", message: "offline" })).toEqual({
      code: "NETWORK",
      message: "offline",
    });
    expect(toAppError(new Error("boom"))).toEqual({ code: "INTERNAL", message: "boom" });
    expect(toAppError("boom")).toEqual({ code: "INTERNAL", message: "boom" });
  });
});

describe("Tauri gateway default construction", () => {
  it("builds with the real invoke function", () => {
    const gateway = createTauriGateway();
    expect(gateway.dataset).toBeDefined();
    expect(gateway.appInfo).toBeDefined();
  });
});
