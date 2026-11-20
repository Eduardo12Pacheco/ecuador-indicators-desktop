import { describe, expect, it } from "vitest";

import { createMemoryGateway } from "../../../adapters/memory/gateway";
import { makeCatalog, makeGeography, makeIndicator, makeSeries } from "../../../test/factories";
import { appError } from "../../domain/errors";
import {
  type Catalog,
  type DatasetInfo,
  indicatorCode,
  iso3,
  type Observation,
  type Settings,
  year,
} from "../../domain/model";
import { err, ok, type Result } from "../../domain/result";
import type { AppPorts, DatasetRepository, ExportGateway } from "../ports";
import { exportCsv } from "./export-csv";
import { loadCatalog } from "./load-catalog";
import { loadExploreModel } from "./load-explore-model";
import { loadRankingModel } from "./load-ranking-model";
import { loadTrajectoriesModel } from "./load-trajectories-model";
import { searchEverything } from "./search-everything";
import { getSettings, updateSettings } from "./settings";
import { openSnapshot, resetSnapshot } from "./snapshot";
import { checkForUpdates } from "./updates";
import { createView, deleteView, listViews, updateView } from "./views";

const GDP = "NY.GDP.MKTP.CD";
const CPI = "FP.CPI.TOTL.ZG";
const POVERTY = "SI.POV.NAHC";

async function setup(): Promise<AppPorts> {
  return createMemoryGateway({ storage: null, download: () => ok("saved") });
}

function exploreRequest(overrides: Record<string, unknown> = {}) {
  return {
    indicator: GDP,
    geographies: ["ECU"],
    from: null,
    to: null,
    transform: "level" as const,
    baseYear: null,
    chart: "line" as const,
    ...overrides,
  };
}

const view = {
  name: "GDP Ecuador",
  spec: {
    kind: "explore" as const,
    indicator: indicatorCode(GDP),
    geographies: [iso3("ECU")],
    from: null,
    to: null,
    transform: "level" as const,
    baseYear: null,
    chart: "line" as const,
  },
};

describe("loadCatalog", () => {
  it("returns the mini catalog", async () => {
    const ports = await setup();
    const result = await loadCatalog(ports.dataset);
    expect(result.ok && result.value.indicators).toHaveLength(6);
  });
});

describe("loadExploreModel", () => {
  it("loads a level series and preserves the chart", async () => {
    const ports = await setup();
    const result = await loadExploreModel(ports.dataset, exploreRequest({ chart: "bar" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.indicator.code).toBe(GDP);
      expect(result.value.series).toHaveLength(1);
      expect(result.value.series[0]?.points.length).toBeGreaterThan(50);
      expect(result.value.chart).toBe("bar");
      expect(result.value.baseYear).toBeNull();
    }
  });

  it("applies YoY and clips the visible range", async () => {
    const ports = await setup();
    const yoy = await loadExploreModel(
      ports.dataset,
      exploreRequest({ transform: "yoy", from: year(2000), to: year(2010) }),
    );
    expect(yoy.ok).toBe(true);
    if (yoy.ok) {
      expect(yoy.value.transform).toBe("yoy");
      expect(
        yoy.value.series[0]?.points.every((point) => point.year >= 2000 && point.year <= 2010),
      ).toBe(true);
    }
  });

  it("indexes to an explicit base and to the first common year", async () => {
    const ports = await setup();
    const explicit = await loadExploreModel(
      ports.dataset,
      exploreRequest({ transform: "index", baseYear: year(2000) }),
    );
    expect(explicit.ok).toBe(true);
    if (explicit.ok) {
      expect(explicit.value.baseYear).toBe(2000);
      expect(explicit.value.series[0]?.points.find((point) => point.year === 2000)?.value).toBe(
        100,
      );
    }
    const implicit = await loadExploreModel(ports.dataset, exploreRequest({ transform: "index" }));
    expect(implicit.ok && implicit.value.baseYear).toBe(1960);
  });

  it("rejects invalid requests and unknown codes", async () => {
    const ports = await setup();
    expect((await loadExploreModel(ports.dataset, exploreRequest({ geographies: [] }))).ok).toBe(
      false,
    );
    expect(
      (
        await loadExploreModel(
          ports.dataset,
          exploreRequest({ geographies: ["ECU", "COL", "PER", "LCN", "WLD", "ECU"] }),
        )
      ).ok,
    ).toBe(false);
    expect((await loadExploreModel(ports.dataset, exploreRequest({ indicator: "NOPE" }))).ok).toBe(
      false,
    );
    expect(
      (await loadExploreModel(ports.dataset, exploreRequest({ geographies: ["NOPE"] }))).ok,
    ).toBe(false);
    expect(
      (
        await loadExploreModel(
          ports.dataset,
          exploreRequest({ transform: "index", baseYear: year(1900) }),
        )
      ).ok,
    ).toBe(false);
  });

  it("propagates catalog and observation failures", async () => {
    const failing = makeFailingDataset("catalog");
    expect((await loadExploreModel(failing, exploreRequest())).ok).toBe(false);
    const failingObservations = makeFailingDataset("observations");
    expect((await loadExploreModel(failingObservations, exploreRequest())).ok).toBe(false);
  });
});

describe("loadTrajectoriesModel", () => {
  it("indexes 2 to 4 indicators to a common or explicit base year", async () => {
    const ports = await setup();
    const implicit = await loadTrajectoriesModel(ports.dataset, {
      indicators: [GDP, CPI],
      geography: iso3("ECU"),
      baseYear: null,
    });
    expect(implicit.ok && implicit.value.baseYear).toBe(1960);
    if (implicit.ok) {
      for (const series of implicit.value.series) {
        expect(series.points.find((point) => point.year === 1960)?.value).toBe(100);
      }
    }
    const explicit = await loadTrajectoriesModel(ports.dataset, {
      indicators: [GDP, CPI],
      geography: iso3("ECU"),
      baseYear: year(2000),
    });
    expect(explicit.ok && explicit.value.baseYear).toBe(2000);
  });

  it("rejects invalid counts, unknown codes and disjoint series", async () => {
    const ports = await setup();
    expect(
      (
        await loadTrajectoriesModel(ports.dataset, {
          indicators: [GDP],
          geography: iso3("ECU"),
          baseYear: null,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await loadTrajectoriesModel(ports.dataset, {
          indicators: [GDP, "NOPE"],
          geography: iso3("ECU"),
          baseYear: null,
        })
      ).ok,
    ).toBe(false);

    const disjoint = makeStubDataset(makeCatalog(), [
      { indicatorCode: indicatorCode(GDP), iso3: iso3("ECU"), year: year(2000), value: 1 },
      { indicatorCode: indicatorCode(CPI), iso3: iso3("ECU"), year: year(2001), value: 2 },
    ]);
    const result = await loadTrajectoriesModel(disjoint, {
      indicators: [GDP, CPI],
      geography: iso3("ECU"),
      baseYear: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.baseYear).toBeNull();
      expect(result.value.series).toEqual([]);
    }
  });
});

describe("loadRankingModel", () => {
  it("ranks values descending and lists missing geographies", async () => {
    const ports = await setup();
    const gdp = await loadRankingModel(ports.dataset, { indicator: GDP, year: year(2020) });
    expect(gdp.ok && gdp.value.ranked).toHaveLength(5);
    if (gdp.ok) {
      const values = gdp.value.ranked.map((row) => row.value);
      expect(values).toEqual([...values].sort((left, right) => right - left));
      expect(gdp.value.missing).toEqual([]);
    }
    const poverty = await loadRankingModel(ports.dataset, {
      indicator: POVERTY,
      year: year(2020),
    });
    expect(poverty.ok && poverty.value.ranked.map((row) => row.geography.iso3)).toEqual([
      "COL",
      "ECU",
      "PER",
    ]);
    expect(poverty.ok && poverty.value.missing.map((geography) => geography.iso3)).toEqual([
      "LCN",
      "WLD",
    ]);
  });

  it("rejects invalid years and unknown indicators", async () => {
    const ports = await setup();
    expect(
      (await loadRankingModel(ports.dataset, { indicator: GDP, year: 1800 as never })).ok,
    ).toBe(false);
    expect(
      (await loadRankingModel(ports.dataset, { indicator: "NOPE", year: year(2020) })).ok,
    ).toBe(false);
  });
});

describe("searchEverything", () => {
  it("searches indicators with Spanish diacritics, geographies, views and actions", async () => {
    const ports = await setup();
    await ports.views.create(view);
    const result = await searchEverything(ports, {
      query: "inflacion",
      lang: "es",
      actions: [{ id: "go-settings", keywords: ["Settings", "Ajustes"] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.indicators[0]?.indicator.code).toBe(CPI);
      expect(result.value.geographies).toEqual([]);
      expect(result.value.actions).toEqual([]);
    }
    const geography = await searchEverything(ports, { query: "ecu", lang: "en" });
    expect(geography.ok && geography.value.geographies[0]?.geography.iso3).toBe("ECU");
    const saved = await searchEverything(ports, { query: "gdp ecuador", lang: "en" });
    expect(saved.ok && saved.value.views[0]?.view.name).toBe("GDP Ecuador");
    const action = await searchEverything(ports, {
      query: "settings",
      lang: "en",
      actions: [{ id: "go-settings", keywords: ["Open settings"] }],
    });
    expect(action.ok && action.value.actions).toEqual([{ id: "go-settings", score: 80 }]);
  });

  it("returns empty groups for an empty query", async () => {
    const ports = await setup();
    expect(await searchEverything(ports, { query: "  ", lang: "en" })).toEqual({
      ok: true,
      value: { indicators: [], geographies: [], views: [], actions: [] },
    });
  });

  it("propagates catalog and view failures", async () => {
    const failing = makeFailingDataset("catalog");
    expect(
      (
        await searchEverything(
          { dataset: failing, views: (await setup()).views },
          { query: "gdp", lang: "en" },
        )
      ).ok,
    ).toBe(false);
  });
});

describe("view use cases", () => {
  it("creates, lists, updates and deletes", async () => {
    const ports = await setup();
    const created = await createView(ports.views, view);
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value.name).toBe("GDP Ecuador");
    expect((await listViews(ports.views)).ok).toBe(true);
    const updated = await updateView(ports.views, created.value.id, { ...view, name: "Renamed" });
    expect(updated.ok && updated.value.name).toBe("Renamed");
    expect((await deleteView(ports.views, created.value.id)).ok).toBe(true);
  });

  it("validates names and specs before hitting the repository", async () => {
    const ports = await setup();
    expect((await createView(ports.views, { ...view, name: " " })).ok).toBe(false);
    expect(
      (await createView(ports.views, { ...view, spec: { ...view.spec, geographies: [] } })).ok,
    ).toBe(false);
    expect((await deleteView(ports.views, " ")).ok).toBe(false);
  });
});

describe("settings use cases", () => {
  it("gets defaults and persists updates", async () => {
    const ports = await setup();
    const current = await getSettings(ports.settings);
    expect(current.ok && current.value.theme).toBe("system");
    const next: Settings = {
      theme: "dark",
      language: "es",
      updateCheckEnabled: true,
      lastUpdateCheck: 10,
      customSnapshotPath: null,
    };
    expect((await updateSettings(ports.settings, next)).ok).toBe(true);
    expect(await ports.settings.get()).toEqual({ ok: true, value: next });
  });
});

describe("exportCsv", () => {
  it("builds long-format CSV with the exact header and filename", async () => {
    const ports = await setup();
    const requests: unknown[] = [];
    const exportGateway: ExportGateway = {
      async save(request) {
        requests.push(request);
        return ok("saved");
      },
    };
    const result = await exportCsv(
      { dataset: ports.dataset, export: exportGateway },
      { indicator: GDP, geographies: [iso3("ECU")], from: year(2000), to: year(2001), lang: "en" },
    );
    expect(result).toEqual({ ok: true, value: "saved" });
    expect(requests[0]).toMatchObject({
      suggestedName: "ecuador-NY.GDP.MKTP.CD-2000-2001.csv",
      kind: "csv",
    });
    const content = (requests[0] as { content: string }).content;
    const lines = content.split("\r\n");
    expect(lines[0]).toBe("indicator_code,indicator_name,iso3,geography,year,value,unit");
    expect(lines[1]).toContain("NY.GDP.MKTP.CD");
    expect(lines.filter((line) => line !== "")).toHaveLength(3);
  });

  it("computes the filename range and rejects empty visible data", async () => {
    const ports = await setup();
    const requests: Array<{ suggestedName: string }> = [];
    const exportGateway: ExportGateway = {
      async save(request) {
        requests.push({ suggestedName: request.suggestedName });
        return ok("saved");
      },
    };
    await exportCsv(
      { dataset: ports.dataset, export: exportGateway },
      { indicator: GDP, geographies: [iso3("ECU")], from: null, to: null, lang: "en" },
    );
    expect(requests[0]?.suggestedName).toMatch(/^ecuador-NY\.GDP\.MKTP\.CD-\d+-\d+\.csv$/);
    expect(
      (
        await exportCsv(
          { dataset: ports.dataset, export: exportGateway },
          {
            indicator: GDP,
            geographies: [iso3("ECU")],
            from: year(1900),
            to: year(1901),
            lang: "en",
          },
        )
      ).ok,
    ).toBe(false);
  });

  it("propagates export gateway failures", async () => {
    const ports = await setup();
    const result = await exportCsv(
      {
        dataset: ports.dataset,
        export: { save: async () => err(appError("EXPORT_REJECTED", "denied")) },
      },
      { indicator: GDP, geographies: [iso3("ECU")], from: year(2000), to: year(2001), lang: "en" },
    );
    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "EXPORT_REJECTED" }),
    });
  });
});

describe("update and snapshot use cases", () => {
  it("delegates the update check", async () => {
    const ports = await setup();
    expect(await checkForUpdates(ports.updates, true)).toEqual({
      ok: true,
      value: { kind: "disabled", current: "0.1.0" },
    });
  });

  it("validates and delegates snapshot operations", async () => {
    const ports = await setup();
    expect((await openSnapshot(ports.dataset, " ")).ok).toBe(false);
    expect((await openSnapshot(ports.dataset, "/tmp/x.sqlite")).ok).toBe(false);
    expect((await resetSnapshot(ports.dataset)).ok).toBe(true);
  });
});

function makeStubDataset(catalog: Catalog, observations: Observation[]): DatasetRepository {
  return {
    async getInfo(): Promise<Result<DatasetInfo>> {
      return err(appError("INTERNAL", "unused"));
    },
    async getCatalog() {
      return ok(catalog);
    },
    async getObservations() {
      return ok(observations);
    },
    async openSnapshot() {
      return err(appError("INTERNAL", "unused"));
    },
    async resetSnapshot() {
      return err(appError("INTERNAL", "unused"));
    },
  };
}

function makeFailingDataset(kind: "catalog" | "observations"): DatasetRepository {
  const catalog: Catalog = makeCatalog();
  const indicator = makeIndicator({ code: indicatorCode(GDP) });
  const geography = makeGeography({ iso3: iso3("ECU") });
  const series = makeSeries([[2020, 1]], { indicator, geography });
  return {
    async getInfo(): Promise<Result<DatasetInfo>> {
      return err(appError("INTERNAL", "unused"));
    },
    async getCatalog() {
      return kind === "catalog" ? err(appError("STORAGE", "boom")) : ok(catalog);
    },
    async getObservations() {
      return kind === "observations"
        ? err(appError("STORAGE", "boom"))
        : ok(
            series.points.map((point) => ({
              indicatorCode: indicator.code,
              iso3: geography.iso3,
              year: point.year,
              value: point.value,
            })),
          );
    },
    async openSnapshot() {
      return err(appError("INTERNAL", "unused"));
    },
    async resetSnapshot() {
      return err(appError("INTERNAL", "unused"));
    },
  };
}
