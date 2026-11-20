import { afterEach, describe, expect, it, vi } from "vitest";
import { indicatorCode, iso3, year } from "../../core/domain/model";
import mini from "./fixtures/mini.snapshot.json";
import { createMemoryGateway, DEFAULT_SETTINGS, type StorageLike } from "./gateway";

function memoryStorage(seed: Record<string, string> = {}): StorageLike & {
  readonly map: Map<string, string>;
} {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

async function setup(storage: StorageLike | null = memoryStorage()) {
  const gateway = await createMemoryGateway({
    storage,
    now: () => 1000,
    id: () => "generated-id",
  });
  return { gateway, storage };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("MemoryGateway snapshot reads", () => {
  it("loads the committed mini fixture", async () => {
    const { gateway } = await setup();
    const info = await gateway.dataset.getInfo();
    expect(info.ok && info.value.counts).toEqual({
      topics: 3,
      geographies: 5,
      indicators: 6,
      observations: 1524,
    });
    expect(info.ok && info.value.license).toBe("CC-BY-4.0");
    const catalog = await gateway.dataset.getCatalog();
    expect(catalog.ok && catalog.value.indicators).toHaveLength(6);
    expect(catalog.ok && catalog.value.geographies.map((geography) => geography.iso3)).toContain(
      "ECU",
    );
  });

  it("filters observations by code and ISO3", async () => {
    const { gateway } = await setup();
    const result = await gateway.dataset.getObservations(["NY.GDP.MKTP.CD"], ["ECU"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeGreaterThan(50);
      expect(result.value.every((observation) => observation.iso3 === "ECU")).toBe(true);
    }
    const none = await gateway.dataset.getObservations(["NOPE"], ["ECU"]);
    expect(none.ok && none.value).toEqual([]);
  });

  it("rejects custom snapshots and resets to the bundled one", async () => {
    const { gateway } = await setup();
    expect((await gateway.dataset.openSnapshot("/tmp/x.sqlite")).ok).toBe(false);
    expect((await gateway.dataset.resetSnapshot()).ok).toBe(true);
  });

  it("reports app info and a disabled update check", async () => {
    const { gateway } = await setup();
    expect(await gateway.appInfo.get()).toEqual({
      ok: true,
      value: {
        version: "0.1.0",
        platform: "web",
        dataDir: "",
        logDir: "",
      },
    });
    expect(await gateway.updates.check(true)).toEqual({
      ok: true,
      value: { kind: "disabled", current: "0.1.0" },
    });
  });

  it("rejects a malformed snapshot", async () => {
    await expect(createMemoryGateway({ snapshot: { schema_version: 1 } })).rejects.toThrow();
  });

  it("fetches the fixture in e2e mode", async () => {
    vi.stubEnv("MODE", "e2e");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(mini), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const gateway = await createMemoryGateway({ storage: null });
    expect(fetchMock).toHaveBeenCalledWith("/__fixture__/snapshot.json");
    expect((await gateway.dataset.getInfo()).ok).toBe(true);
  });

  it("fails when the fixture request fails", async () => {
    vi.stubEnv("MODE", "capture");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    await expect(createMemoryGateway({ storage: null })).rejects.toThrow("404");
  });
});

describe("MemoryGateway views", () => {
  const view = {
    name: "  GDP Ecuador  ",
    spec: {
      kind: "explore" as const,
      indicator: indicatorCode("NY.GDP.MKTP.CD"),
      geographies: [iso3("ECU")],
      from: year(2000),
      to: year(2020),
      transform: "level" as const,
      baseYear: null,
      chart: "line" as const,
    },
  };

  it("creates, lists, updates and deletes views with persistence", async () => {
    const storage = memoryStorage();
    const { gateway } = await setup(storage);
    const created = await gateway.views.create(view);
    expect(created.ok && created.value.id).toBe("generated-id");
    expect(created.ok && created.value.name).toBe("GDP Ecuador");

    const listed = await gateway.views.list();
    expect(listed.ok && listed.value).toHaveLength(1);

    const updated = await gateway.views.update("generated-id", { ...view, name: "Renamed" });
    expect(updated.ok && updated.value.name).toBe("Renamed");
    expect(updated.ok && updated.value.createdAt).toBe(1000);

    const removed = await gateway.views.remove("generated-id");
    expect(removed.ok).toBe(true);
    expect((await gateway.views.list()).ok).toBe(true);

    const restored = await createMemoryGateway({ storage });
    expect(((await restored.views.list()) as { ok: true; value: unknown[] }).value).toEqual([]);
  });

  it("rejects unknown ids, invalid names and invalid specs", async () => {
    const { gateway } = await setup();
    expect((await gateway.views.update("missing", view)).ok).toBe(false);
    expect((await gateway.views.remove("missing")).ok).toBe(false);
    expect((await gateway.views.create({ ...view, name: "  " })).ok).toBe(false);
    expect(
      (
        await gateway.views.create({
          name: "bad",
          spec: { ...view.spec, geographies: [] },
        })
      ).ok,
    ).toBe(false);
  });

  it("enforces the 200-view limit", async () => {
    const { gateway } = await setup(memoryStorage());
    for (let index = 0; index < 200; index += 1) {
      const result = await gateway.views.create({ ...view, name: `view ${index}` });
      expect(result.ok).toBe(true);
    }
    const result = await gateway.views.create({ ...view, name: "overflow" });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "LIMIT_EXCEEDED" }),
    });
  });

  it("survives corrupt stored views", async () => {
    const gateway = await createMemoryGateway({
      storage: memoryStorage({ "ei:views": "not json" }),
    });
    expect((await gateway.views.list()).ok).toBe(true);
  });
});

describe("MemoryGateway settings", () => {
  it("returns defaults and persists updates", async () => {
    const storage = memoryStorage();
    const { gateway } = await setup(storage);
    expect(await gateway.settings.get()).toEqual({ ok: true, value: DEFAULT_SETTINGS });
    const updated = { ...DEFAULT_SETTINGS, theme: "dark" as const, language: "es" as const };
    expect((await gateway.settings.set(updated)).ok).toBe(true);
    const restored = await createMemoryGateway({ storage });
    expect(await restored.settings.get()).toEqual({ ok: true, value: updated });
  });

  it("survives corrupt stored settings", async () => {
    const gateway = await createMemoryGateway({
      storage: memoryStorage({ "ei:settings": JSON.stringify({ theme: "neon" }) }),
    });
    const settings = await gateway.settings.get();
    expect(settings.ok && settings.value.theme).toBe("neon");
  });
});

describe("MemoryGateway export", () => {
  it("uses the injected download function", async () => {
    const download = vi.fn(() => ({ ok: true as const, value: "saved" }));
    const gateway = await createMemoryGateway({ storage: null, download });
    const result = await gateway.export.save({
      suggestedName: "x.csv",
      kind: "csv",
      content: "a,b\r\n",
    });
    expect(result).toEqual({ ok: true, value: "saved" });
    expect(download).toHaveBeenCalledOnce();
  });

  it("downloads through a Blob URL by default", async () => {
    const createObjectURL = vi.fn(() => "blob:abc");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.fn();
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const element = original(tag);
      if (tag === "a") {
        element.click = click;
      }
      return element;
    });
    const gateway = await createMemoryGateway({ storage: null });
    const result = await gateway.export.save({
      suggestedName: "x.png",
      kind: "png",
      content: new Uint8Array([1, 2, 3]),
    });
    expect(result).toEqual({ ok: true, value: "download" });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:abc");
  });
});

describe("MemoryGateway storage failures", () => {
  it("works without localStorage and when reads/writes throw", async () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const gateway = await createMemoryGateway({ storage: throwing });
    expect((await gateway.settings.get()).ok).toBe(true);
    expect((await gateway.views.list()).ok).toBe(true);
    expect((await gateway.settings.set(DEFAULT_SETTINGS)).ok).toBe(true);
  });
});

describe("MemoryGateway validation", () => {
  it("rejects invalid updates", async () => {
    const { gateway } = await setup();
    const created = await gateway.views.create({
      name: "ok",
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
    });
    if (!created.ok) {
      throw new Error("setup failed");
    }
    const spec = created.value.spec;
    expect((await gateway.views.update(created.value.id, { name: " ", spec })).ok).toBe(false);
    expect(
      (
        await gateway.views.update(created.value.id, {
          name: "ok",
          spec: { ...created.value.spec, geographies: [] } as never,
        })
      ).ok,
    ).toBe(false);
  });

  it("reports a browser download failure", async () => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => {
        throw new Error("blocked");
      },
    });
    const gateway = await createMemoryGateway({ storage: null });
    const result = await gateway.export.save({
      suggestedName: "x.csv",
      kind: "csv",
      content: "a",
    });
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "EXPORT_REJECTED" }),
    });
  });

  it("uses localStorage by default", async () => {
    const storage = globalThis.localStorage;
    storage.clear();
    const gateway = await createMemoryGateway({ now: () => 1, id: () => "id" });
    expect((await gateway.settings.get()).ok).toBe(true);
    expect((await gateway.views.list()).ok).toBe(true);
  });
});
