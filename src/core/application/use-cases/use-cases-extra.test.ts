import { describe, expect, it } from "vitest";

import { createMemoryGateway } from "../../../adapters/memory/gateway";
import {
  makeCatalog,
  makeIndicator,
  makeSavedView,
  makeSettings,
  okAsync,
} from "../../../test/factories";
import { appError } from "../../domain/errors";
import {
  type Catalog,
  type DatasetInfo,
  indicatorCode,
  iso3,
  type Observation,
  year,
} from "../../domain/model";
import { err, ok, type Result } from "../../domain/result";
import type { DatasetRepository, ExportGateway, ViewRepository } from "../ports";
import { exportCsv } from "./export-csv";
import { loadExploreModel } from "./load-explore-model";
import { loadRankingModel } from "./load-ranking-model";
import { loadSeries } from "./load-series";
import { loadTrajectoriesModel } from "./load-trajectories-model";
import { searchEverything } from "./search-everything";
import { getSettings, updateSettings } from "./settings";
import { openSnapshot, resetSnapshot } from "./snapshot";
import { deleteView, updateView } from "./views";

const GDP = "NY.GDP.MKTP.CD";
const CPI = "FP.CPI.TOTL.ZG";

function stubDataset(input: {
  catalog?: Result<Catalog>;
  observations?: Result<readonly Observation[]>;
}): DatasetRepository {
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
    counts: { topics: 0, geographies: 0, indicators: 0, observations: 0 },
  };
  return {
    getInfo: () => okAsync(info),
    getCatalog: () => Promise.resolve(input.catalog ?? ok(makeCatalog())),
    getObservations: () => Promise.resolve(input.observations ?? ok([])),
    openSnapshot: () => okAsync(info),
    resetSnapshot: () => okAsync(info),
  };
}

describe("loadSeries", () => {
  it("validates codes and geographies and propagates failures", async () => {
    const catalog = makeCatalog();
    const dataset = stubDataset({});
    expect(await loadSeries(dataset, catalog, ["NOPE"], ["ECU"])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
    expect(await loadSeries(dataset, catalog, [GDP], ["NOPE"])).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "INVALID_INPUT" }),
    });
    expect(
      await loadSeries(
        stubDataset({ observations: err(appError("STORAGE", "x")) }),
        catalog,
        [GDP],
        ["ECU"],
      ),
    ).toEqual({ ok: false, error: expect.objectContaining({ code: "STORAGE" }) });
    const nonFinite = stubDataset({
      observations: ok([
        {
          indicatorCode: indicatorCode(GDP),
          iso3: iso3("ECU"),
          year: year(2020),
          value: Number.NaN,
        },
      ]),
    });
    expect((await loadSeries(nonFinite, catalog, [GDP], ["ECU"])).ok).toBe(false);
    const duplicate = stubDataset({
      observations: ok([
        { indicatorCode: indicatorCode(GDP), iso3: iso3("ECU"), year: year(2020), value: 1 },
        { indicatorCode: indicatorCode(GDP), iso3: iso3("ECU"), year: year(2020), value: 2 },
      ]),
    });
    expect((await loadSeries(duplicate, catalog, [GDP], ["ECU"])).ok).toBe(false);
  });
});

describe("use-case error propagation", () => {
  it("propagates catalog failures from every loader", async () => {
    const failing = stubDataset({ catalog: err(appError("STORAGE", "x")) });
    expect(
      (
        await loadExploreModel(failing, {
          indicator: GDP,
          geographies: ["ECU"],
          from: null,
          to: null,
          transform: "level",
          baseYear: null,
          chart: "line",
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await loadTrajectoriesModel(failing, {
          indicators: [GDP, CPI],
          geography: iso3("ECU"),
          baseYear: null,
        })
      ).ok,
    ).toBe(false);
    expect((await loadRankingModel(failing, { indicator: GDP, year: year(2020) })).ok).toBe(false);
    expect(
      (
        await searchEverything(
          { dataset: failing, views: (await gateway()).views },
          {
            query: "gdp",
            lang: "en",
          },
        )
      ).ok,
    ).toBe(false);
  });

  it("propagates observation failures from ranking and trajectories", async () => {
    const failing = stubDataset({ observations: err(appError("STORAGE", "x")) });
    expect((await loadRankingModel(failing, { indicator: GDP, year: year(2020) })).ok).toBe(false);
    expect(
      (
        await loadTrajectoriesModel(failing, {
          indicators: [GDP, CPI],
          geography: iso3("ECU"),
          baseYear: null,
        })
      ).ok,
    ).toBe(false);
  });

  it("reports an index error for a missing explicit base year", async () => {
    const dataset = stubDataset({
      observations: ok([
        { indicatorCode: indicatorCode(GDP), iso3: iso3("ECU"), year: year(2000), value: 1 },
        { indicatorCode: indicatorCode(CPI), iso3: iso3("ECU"), year: year(2000), value: 2 },
      ]),
    });
    expect(
      (
        await loadTrajectoriesModel(dataset, {
          indicators: [GDP, CPI],
          geography: iso3("ECU"),
          baseYear: year(1900),
        })
      ).ok,
    ).toBe(false);
  });

  it("propagates view failures from searchEverything", async () => {
    const ports = await gateway();
    const failingViews: ViewRepository = {
      ...ports.views,
      list: () => Promise.resolve(err(appError("STORAGE", "x"))),
    };
    expect(
      (
        await searchEverything(
          { dataset: ports.dataset, views: failingViews },
          {
            query: "gdp",
            lang: "en",
          },
        )
      ).ok,
    ).toBe(false);
  });
});

describe("searchEverything ranking details", () => {
  async function search(
    query: string,
    lang: "en" | "es",
    actions?: { id: string; keywords: string[] }[],
  ) {
    const ports = await gateway();
    return searchEverything(
      ports,
      actions === undefined ? { query, lang } : { query, lang, actions },
    );
  }

  it("scores geography names and sorts by score then order", async () => {
    const byName = await search("ecuador", "en");
    expect(byName.ok && byName.value.geographies[0]?.geography.iso3).toBe("ECU");
    const byPrefix = await search("col", "en");
    expect(byPrefix.ok && byPrefix.value.geographies[0]?.geography.iso3).toBe("COL");
    const bySubstring = await search("uad", "en");
    expect(bySubstring.ok && bySubstring.value.geographies[0]?.geography.iso3).toBe("ECU");
  });

  it("scores view names by token prefix and substring", async () => {
    const ports = await gateway();
    await ports.views.create({
      name: "Regional outlook",
      spec: {
        kind: "ranking",
        indicator: indicatorCode(GDP),
        year: year(2020),
      },
    });
    const prefix = await searchEverything(
      { dataset: ports.dataset, views: ports.views },
      {
        query: "region",
        lang: "en",
      },
    );
    expect(prefix.ok && prefix.value.views[0]?.score).toBe(80);
    const substring = await searchEverything(
      { dataset: ports.dataset, views: ports.views },
      {
        query: "ook",
        lang: "en",
      },
    );
    expect(substring.ok && substring.value.views[0]?.score).toBe(60);
  });

  it("scores actions by exact, token prefix, substring and ignores misses", async () => {
    const exact = await search("settings", "en", [
      { id: "a", keywords: ["Settings"] },
      { id: "b", keywords: ["nothing here"] },
    ]);
    expect(exact.ok && exact.value.actions).toEqual([{ id: "a", score: 100 }]);
    const prefix = await search("set", "en", [{ id: "a", keywords: ["Go settings"] }]);
    expect(prefix.ok && prefix.value.actions[0]?.score).toBe(80);
    const substring = await search("ttin", "en", [{ id: "a", keywords: ["Settings"] }]);
    expect(substring.ok && substring.value.actions[0]?.score).toBe(60);
    const none = await search("zzz", "en", [{ id: "a", keywords: ["Settings"] }]);
    expect(none.ok && none.value.actions).toEqual([]);
  });
});

describe("additional use-case failure paths", () => {
  it("propagates setting and view repository failures", async () => {
    expect(
      (
        await getSettings({
          get: () => Promise.resolve(err(appError("STORAGE", "x"))),
          set: () => okAsync(undefined),
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await updateSettings(
          {
            get: () => okAsync(makeSettings()),
            set: () => Promise.resolve(err(appError("STORAGE", "x"))),
          },
          makeSettings(),
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await deleteView(
          {
            list: () => okAsync([]),
            create: () => okAsync(makeSavedView()),
            update: () => okAsync(makeSavedView()),
            remove: () => Promise.resolve(err(appError("VIEW_NOT_FOUND", "x"))),
          },
          "id",
        )
      ).ok,
    ).toBe(false);
  });

  it("propagates snapshot adapter failures", async () => {
    const failing = stubDataset({});
    const failingSnapshot: DatasetRepository = {
      ...failing,
      openSnapshot: () => Promise.resolve(err(appError("SNAPSHOT_INVALID", "x"))),
      resetSnapshot: () => Promise.resolve(err(appError("SNAPSHOT_NOT_FOUND", "x"))),
    };
    expect((await openSnapshot(failingSnapshot, "/x.sqlite")).ok).toBe(false);
    expect((await resetSnapshot(failingSnapshot)).ok).toBe(false);
  });

  it("propagates export failures from the CSV builder", async () => {
    const ports = await gateway();
    const exportGateway: ExportGateway = { save: () => okAsync("saved") };
    expect(
      (
        await exportCsv(
          { dataset: ports.dataset, export: exportGateway },
          { indicator: "NOPE", geographies: [iso3("ECU")], from: null, to: null, lang: "en" },
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await exportCsv(
          { dataset: ports.dataset, export: exportGateway },
          { indicator: GDP, geographies: [], from: null, to: null, lang: "en" },
        )
      ).ok,
    ).toBe(false);
  });
});

async function gateway() {
  return createMemoryGateway({ storage: null, download: () => ok("saved") });
}

describe("remaining branch coverage", () => {
  it("reports no common base year for Index and a reversed clip range", async () => {
    const disjoint = stubDataset({
      observations: ok([
        { indicatorCode: indicatorCode(GDP), iso3: iso3("ECU"), year: year(2000), value: 1 },
        { indicatorCode: indicatorCode(GDP), iso3: iso3("COL"), year: year(2001), value: 2 },
      ]),
    });
    const noBase = await loadExploreModel(disjoint, {
      indicator: GDP,
      geographies: ["ECU", "COL"],
      from: null,
      to: null,
      transform: "index",
      baseYear: null,
      chart: "line",
    });
    expect(noBase).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "BASE_YEAR_MISSING" }),
    });
    const ports = await gateway();
    const reversed = await loadExploreModel(ports.dataset, {
      indicator: GDP,
      geographies: ["ECU"],
      from: year(2020),
      to: year(2000),
      transform: "level",
      baseYear: null,
      chart: "line",
    });
    expect(reversed.ok).toBe(false);
  });

  it("rejects an invalid update before touching the repository", async () => {
    const ports = await gateway();
    const created = await ports.views.create({
      name: "valid",
      spec: { kind: "ranking", indicator: indicatorCode(GDP), year: year(2020) },
    });
    if (!created.ok) {
      throw new Error("setup failed");
    }
    expect(
      (await updateView(ports.views, created.value.id, { ...created.value, name: "" })).ok,
    ).toBe(false);
  });

  it("breaks search ties by code when sort order matches", async () => {
    const base = makeCatalog();
    const first = makeIndicator({
      code: indicatorCode("ZZZ"),
      nameEn: "Same name",
      nameEs: "Same name",
      sortOrder: 1,
    });
    const second = makeIndicator({
      code: indicatorCode("AAA"),
      nameEn: "Same name",
      nameEs: "Same name",
      sortOrder: 1,
    });
    const ports = await gateway();
    const result = await searchEverything(
      {
        dataset: stubDataset({ catalog: ok({ ...base, indicators: [first, second] }) }),
        views: ports.views,
      },
      { query: "same", lang: "en" },
    );
    expect(result.ok && result.value.indicators.map((hit) => hit.indicator.code)).toEqual([
      "AAA",
      "ZZZ",
    ]);
  });
});

describe("search result ordering with mixed scores", () => {
  it("sorts geographies and views by mixed scores", async () => {
    const ports = await gateway();
    await ports.views.create({
      name: "Outlook",
      spec: { kind: "ranking", indicator: indicatorCode(GDP), year: year(2020) },
    });
    await ports.views.create({
      name: "Look ahead",
      spec: { kind: "ranking", indicator: indicatorCode(GDP), year: year(2020) },
    });
    const views = await searchEverything(
      { dataset: ports.dataset, views: ports.views },
      {
        query: "look",
        lang: "en",
      },
    );
    expect(views.ok && views.value.views.map((hit) => hit.view.name).sort()).toEqual([
      "Look ahead",
      "Outlook",
    ]);
    const geo = await searchEverything(
      { dataset: ports.dataset, views: ports.views },
      {
        query: "l",
        lang: "en",
      },
    );
    expect(geo.ok && geo.value.geographies.length).toBeGreaterThan(1);
  });

  it("sorts actions with mixed and tied scores", async () => {
    const ports = await gateway();
    const result = await searchEverything(
      { dataset: ports.dataset, views: ports.views },
      {
        query: "set",
        lang: "en",
        actions: [
          { id: "b", keywords: ["Preset"] },
          { id: "a", keywords: ["Settings"] },
          { id: "c", keywords: ["Reset preset"] },
        ],
      },
    );
    expect(result.ok && result.value.actions.map((hit) => hit.id)).toEqual(["a", "b", "c"]);
  });
});
