import { describe, expect, it } from "vitest";
import type { AppPorts, DatasetRepository, ViewRepository } from "../../core/application/ports";
import type { Catalog, DatasetInfo, Observation } from "../../core/domain/model";
import { err, ok, type Result } from "../../core/domain/result";
import {
  makeAppInfo,
  makeCatalog,
  makeSavedView,
  makeSettings,
  okAsync,
} from "../../test/factories";
import { CachedDatasetRepository } from "./cached";
import {
  FAULT_KEY,
  FaultInjectingDatasetRepository,
  FaultInjectingViewRepository,
  readFault,
  withFaultInjection,
} from "./fault-injection";

function fakeStorage(value: string | null) {
  return { getItem: (key: string) => (key === FAULT_KEY ? value : null) };
}

interface CallCounts {
  catalog: number;
  observations: number;
  open: number;
  reset: number;
}

function fakeDataset(overrides: Partial<DatasetRepository> = {}): DatasetRepository & {
  calls: CallCounts;
} {
  const calls: CallCounts = { catalog: 0, observations: 0, open: 0, reset: 0 };
  const info: DatasetInfo = {
    schemaVersion: 1,
    origin: "worldbank",
    datasetId: "id",
    datasetVersion: "v",
    sourceName: "n",
    sourcePublisher: "p",
    sourceLastUpdated: "d",
    retrievedAt: "r",
    license: "CC-BY-4.0",
    licenseUrl: "u",
    attributionEn: "a",
    attributionEs: "a",
    counts: { topics: 1, geographies: 1, indicators: 1, observations: 1 },
  };
  return {
    calls,
    async getInfo() {
      return ok(info);
    },
    async getCatalog() {
      calls.catalog += 1;
      return ok(makeCatalog());
    },
    async getObservations() {
      calls.observations += 1;
      return ok([] as Observation[]);
    },
    async openSnapshot() {
      calls.open += 1;
      return ok(info);
    },
    async resetSnapshot() {
      calls.reset += 1;
      return ok(info);
    },
    ...overrides,
  };
}

describe("fault injection", () => {
  it("reads only known faults", () => {
    expect(readFault(fakeStorage("catalog"))).toBe("catalog");
    expect(readFault(fakeStorage("snapshot"))).toBe("snapshot");
    expect(readFault(fakeStorage("nope"))).toBeNull();
    expect(readFault(null)).toBeNull();
  });

  it("fails the selected dataset read with STORAGE", async () => {
    const inner = fakeDataset();
    const catalogFault = new FaultInjectingDatasetRepository(inner, fakeStorage("catalog"));
    expect(await catalogFault.getCatalog()).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "STORAGE" }),
    });
    expect((await catalogFault.getInfo()).ok).toBe(true);
    expect((await catalogFault.getObservations([], [])).ok).toBe(true);

    const observationFault = new FaultInjectingDatasetRepository(
      inner,
      fakeStorage("observations"),
    );
    expect((await observationFault.getObservations([], [])).ok).toBe(false);
    expect((await observationFault.getCatalog()).ok).toBe(true);
    expect((await observationFault.openSnapshot("/x")).ok).toBe(true);
    expect((await observationFault.resetSnapshot()).ok).toBe(true);

    const snapshotFault = new FaultInjectingDatasetRepository(inner, fakeStorage("snapshot"));
    expect(await snapshotFault.getInfo()).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "SNAPSHOT_INVALID" }),
    });
    expect((await snapshotFault.getCatalog()).ok).toBe(true);
  });

  it("fails view reads with STORAGE but keeps writes", async () => {
    const inner: ViewRepository = {
      list: () => okAsync([makeSavedView()]),
      create: () => okAsync(makeSavedView()),
      update: () => okAsync(makeSavedView()),
      remove: () => okAsync(undefined),
    };
    const faulted = new FaultInjectingViewRepository(inner, fakeStorage("views"));
    expect((await faulted.list()).ok).toBe(false);
    expect((await faulted.create({ name: "n", spec: makeSavedView().spec })).ok).toBe(true);
    expect((await faulted.update("id", { name: "n", spec: makeSavedView().spec })).ok).toBe(true);
    expect((await faulted.remove("id")).ok).toBe(true);
  });

  it("wraps a complete gateway", async () => {
    const dataset = fakeDataset();
    const views: ViewRepository = {
      list: () => okAsync([makeSavedView()]),
      create: () => okAsync(makeSavedView()),
      update: () => okAsync(makeSavedView()),
      remove: () => okAsync(undefined),
    };
    const ports: AppPorts = {
      dataset,
      views,
      settings: {
        get: () => okAsync(makeSettings()),
        set: () => okAsync(undefined),
      },
      export: { save: () => okAsync("saved") },
      updates: { check: () => okAsync({ kind: "disabled", current: "0.1.0" }) },
      appInfo: { get: () => okAsync(makeAppInfo()) },
      snapshotPicker: { pickSnapshot: () => okAsync(null) },
      externalLinks: { open: () => okAsync(undefined) },
    };
    const wrapped = withFaultInjection(ports, fakeStorage("views"));
    expect((await wrapped.views.list()).ok).toBe(false);
    expect((await wrapped.settings.get()).ok).toBe(true);
    expect((await wrapped.export.save({ suggestedName: "x", kind: "csv", content: "" })).ok).toBe(
      true,
    );
    expect((await wrapped.updates.check(false)).ok).toBe(true);
    expect((await wrapped.appInfo.get()).ok).toBe(true);
  });
});

describe("CachedDatasetRepository", () => {
  it("memoizes catalog and observations by key", async () => {
    const inner = fakeDataset();
    const cached = new CachedDatasetRepository(inner);
    const first = await cached.getCatalog();
    const second = await cached.getCatalog();
    expect(first).toEqual(second);
    expect(inner.calls.catalog).toBe(1);
    await cached.getObservations(["A", "B"], ["ECU", "COL"]);
    await cached.getObservations(["B", "A"], ["COL", "ECU"]);
    expect(inner.calls.observations).toBe(1);
    await cached.getObservations(["A"], ["ECU"]);
    expect(inner.calls.observations).toBe(2);
  });

  it("does not cache failures and passes info through", async () => {
    let attempts = 0;
    const inner = fakeDataset({
      async getCatalog(): Promise<Result<Catalog>> {
        attempts += 1;
        return attempts === 1 ? err({ code: "STORAGE", message: "x" }) : ok(makeCatalog());
      },
    });
    const cached = new CachedDatasetRepository(inner);
    expect((await cached.getCatalog()).ok).toBe(false);
    expect((await cached.getCatalog()).ok).toBe(true);
    expect(attempts).toBe(2);
    expect((await cached.getInfo()).ok).toBe(true);
  });

  it("invalidates only after a successful open/reset", async () => {
    const inner = fakeDataset();
    const cached = new CachedDatasetRepository(inner);
    await cached.getCatalog();
    await cached.openSnapshot("/x");
    await cached.getCatalog();
    expect(inner.calls.catalog).toBe(2);
    await cached.getCatalog();
    expect(inner.calls.catalog).toBe(2);
    await cached.resetSnapshot();
    await cached.getCatalog();
    expect(inner.calls.catalog).toBe(3);
    cached.invalidate();
    await cached.getCatalog();
    expect(inner.calls.catalog).toBe(4);
  });

  it("keeps the cache when open fails", async () => {
    const inner = fakeDataset({
      async openSnapshot() {
        return err({ code: "SNAPSHOT_INVALID", message: "bad" });
      },
    });
    const cached = new CachedDatasetRepository(inner);
    await cached.getCatalog();
    expect((await cached.openSnapshot("/bad")).ok).toBe(false);
    await cached.getCatalog();
    expect(inner.calls.catalog).toBe(1);
  });
});

describe("CachedDatasetRepository failure paths", () => {
  it("does not cache observation failures and keeps the cache when reset fails", async () => {
    let attempts = 0;
    const inner = fakeDataset({
      async getObservations() {
        attempts += 1;
        return attempts === 1 ? err({ code: "STORAGE", message: "x" }) : ok([]);
      },
      async resetSnapshot() {
        return err({ code: "STORAGE", message: "x" });
      },
    });
    const cached = new CachedDatasetRepository(inner);
    expect((await cached.getObservations(["A"], ["ECU"])).ok).toBe(false);
    expect((await cached.getObservations(["A"], ["ECU"])).ok).toBe(true);
    await cached.getCatalog();
    expect((await cached.resetSnapshot()).ok).toBe(false);
    await cached.getCatalog();
    expect(inner.calls.catalog).toBe(1);
  });
});
