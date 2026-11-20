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

describe("Tauri native dialogs", () => {
  interface DialogHarness {
    readonly gateway: ReturnType<typeof createTauriGateway>;
    readonly calls: Array<{ command: string; args: Record<string, unknown> | undefined }>;
    readonly saved: Array<{ defaultPath?: string; filters?: unknown }>;
    readonly opened: Array<{ multiple?: boolean; filters?: unknown }>;
    readonly openedUrls: string[];
  }

  function dialogHarness(
    options: {
      readonly saveResult?: string | null;
      readonly openResult?: string | null;
      readonly saveError?: Error;
      readonly openUrlError?: Error;
    } = {},
  ): DialogHarness {
    const calls: DialogHarness["calls"] = [];
    const saved: DialogHarness["saved"] = [];
    const opened: DialogHarness["opened"] = [];
    const openedUrls: string[] = [];
    const gateway = createTauriGateway(
      async (command, args) => {
        calls.push({ command, args });
        if (command !== "export_save") {
          throw new Error(`unexpected command ${command}`);
        }
        return args?.path;
      },
      {
        async save(dialogOptions) {
          saved.push(dialogOptions);
          if (options.saveError !== undefined) {
            throw options.saveError;
          }
          return options.saveResult === undefined ? "/home/eduardo/out.csv" : options.saveResult;
        },
        async open(dialogOptions) {
          opened.push(dialogOptions);
          return options.openResult === undefined ? "/tmp/custom.sqlite" : options.openResult;
        },
        async openUrl(url) {
          if (options.openUrlError !== undefined) {
            throw options.openUrlError;
          }
          openedUrls.push(url);
        },
      },
    );
    return { gateway, calls, saved, opened, openedUrls };
  }

  it("saves CSV through the native dialog and the export command", async () => {
    const harness = dialogHarness();
    const result = await harness.gateway.export.save({
      suggestedName: "ecuador-GDP-2000-2020.csv",
      kind: "csv",
      content: "a,b\r\n1,2\r\n",
    });
    expect(result).toEqual({ ok: true, value: "/home/eduardo/out.csv" });
    expect(harness.saved[0]?.defaultPath).toBe("ecuador-GDP-2000-2020.csv");
    expect(harness.calls).toHaveLength(1);
    expect(harness.calls[0]?.command).toBe("export_save");
    expect(
      new TextDecoder().decode(new Uint8Array(harness.calls[0]?.args?.content as number[])),
    ).toBe("a,b\r\n1,2\r\n");
  });

  it("passes PNG bytes unchanged and cancels silently", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const first = dialogHarness();
    await first.gateway.export.save({ suggestedName: "chart.png", kind: "png", content: bytes });
    expect(first.calls[0]?.args?.content).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const cancelled = dialogHarness({ saveResult: null });
    const result = await cancelled.gateway.export.save({
      suggestedName: "chart.png",
      kind: "png",
      content: bytes,
    });
    expect(result).toEqual({ ok: true, value: "cancelled" });
    expect(cancelled.calls).toEqual([]);
  });

  it("maps a failing save dialog to a typed export error", async () => {
    const harness = dialogHarness({ saveError: new Error("dialog closed") });
    const result = await harness.gateway.export.save({
      suggestedName: "chart.png",
      kind: "png",
      content: bytes(),
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "EXPORT_REJECTED" }),
    });
  });

  it("picks a snapshot path and treats cancel as null", async () => {
    const chosen = dialogHarness();
    expect(await chosen.gateway.snapshotPicker.pickSnapshot()).toEqual({
      ok: true,
      value: "/tmp/custom.sqlite",
    });
    expect(chosen.opened[0]?.filters).toEqual([{ name: "Snapshot", extensions: ["sqlite", "db"] }]);

    const cancelled = dialogHarness({ openResult: null });
    expect(await cancelled.gateway.snapshotPicker.pickSnapshot()).toEqual({
      ok: true,
      value: null,
    });
  });

  it("opens external links through the opener plugin and rejects non-https URLs", async () => {
    const harness = dialogHarness();
    expect(
      await harness.gateway.externalLinks.open("https://creativecommons.org/licenses/by/4.0/"),
    ).toEqual({ ok: true, value: undefined });
    expect(harness.openedUrls).toEqual(["https://creativecommons.org/licenses/by/4.0/"]);
    expect(await harness.gateway.externalLinks.open("file:///etc/passwd")).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
    expect(harness.openedUrls).toHaveLength(1);
  });
});

function bytes(): Uint8Array {
  return new Uint8Array([1]);
}
