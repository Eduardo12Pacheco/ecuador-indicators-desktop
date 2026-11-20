import { describe, expect, it } from "vitest";
import { indicatorCode, iso3, type ViewSpec, year } from "../../core/domain/model";
import { makeSavedView, makeSettings } from "../../test/factories";
import type { ViewSpec as WireViewSpec } from "./generated/ViewSpec";
import {
  mapAppInfo,
  mapCatalog,
  mapDatasetInfo,
  mapGeography,
  mapIndicator,
  mapObservation,
  mapSavedView,
  mapSettings,
  mapTopic,
  mapUpdateStatus,
  mapViewSpec,
  newViewToWire,
  settingsToWire,
  viewSpecToWire,
} from "./mappers";

describe("wire mappers", () => {
  it("maps catalog metadata into the domain shape", () => {
    expect(
      mapTopic({ id: "economy", name_en: "Economy", name_es: "Economía", sort_order: 1 }),
    ).toEqual({
      id: "economy",
      nameEn: "Economy",
      nameEs: "Economía",
      sortOrder: 1,
    });
    expect(
      mapGeography({
        iso3: "ECU",
        iso2: "EC",
        name_en: "Ecuador",
        name_es: "Ecuador",
        is_aggregate: false,
        sort_order: 1,
      }),
    ).toEqual({
      iso3: "ECU",
      iso2: "EC",
      nameEn: "Ecuador",
      nameEs: "Ecuador",
      isAggregate: false,
      sortOrder: 1,
    });
    expect(
      mapIndicator({
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
      }),
    ).toMatchObject({ code: "NY.GDP.MKTP.CD", topicId: "economy", valueKind: "currency" });
    expect(
      mapCatalog({
        topics: [],
        geographies: [],
        indicators: [],
      }),
    ).toEqual({ topics: [], geographies: [], indicators: [] });
  });

  it("maps dataset info and observations", () => {
    expect(
      mapDatasetInfo({
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
      }),
    ).toMatchObject({ schemaVersion: 1, counts: { observations: 11780 } });
    expect(mapObservation({ indicator_code: "X", iso3: "ECU", year: 2020, value: 1.5 })).toEqual({
      indicatorCode: "X",
      iso3: "ECU",
      year: 2020,
      value: 1.5,
    });
  });

  it("maps every view variant and round-trips through the wire form", () => {
    const specs: ViewSpec[] = [
      {
        kind: "explore",
        indicator: indicatorCode("NY.GDP.MKTP.CD"),
        geographies: [iso3("ECU"), iso3("COL")],
        from: year(2000),
        to: year(2020),
        transform: "index",
        baseYear: year(2010),
        chart: "bar",
      },
      {
        kind: "trajectories",
        indicators: [indicatorCode("A"), indicatorCode("B")],
        geography: iso3("ECU"),
        baseYear: null,
      },
      { kind: "ranking", indicator: indicatorCode("X"), year: year(2020) },
    ];
    for (const spec of specs) {
      expect(mapViewSpec(viewSpecToWire(spec))).toEqual(spec);
    }
  });

  it("maps saved views, settings, update status and app info", () => {
    const view = makeSavedView();
    expect(
      mapSavedView({
        id: view.id,
        name: view.name,
        spec: viewSpecToWire(view.spec),
        created_at: view.createdAt,
        updated_at: view.updatedAt,
      }),
    ).toEqual(view);
    const settings = makeSettings();
    expect(
      mapSettings({
        theme: settings.theme,
        language: settings.language,
        update_check_enabled: settings.updateCheckEnabled,
        last_update_check: settings.lastUpdateCheck,
        custom_snapshot_path: settings.customSnapshotPath,
      }),
    ).toEqual(settings);
    expect(newViewToWire({ name: " n ", spec: view.spec })).toEqual({
      name: " n ",
      spec: viewSpecToWire(view.spec),
    });
    expect(settingsToWire(settings)).toMatchObject({ update_check_enabled: false });
    expect(mapUpdateStatus({ kind: "up_to_date", current: "0.1.0" })).toEqual({
      kind: "up_to_date",
      current: "0.1.0",
    });
    expect(
      mapUpdateStatus({
        kind: "available",
        current: "0.1.0",
        latest: "0.2.0",
        url: "https://example.test",
        published_at: null,
      }),
    ).toEqual({
      kind: "available",
      current: "0.1.0",
      latest: "0.2.0",
      url: "https://example.test",
      publishedAt: null,
    });
    expect(mapUpdateStatus({ kind: "disabled", current: "0.1.0" })).toEqual({
      kind: "disabled",
      current: "0.1.0",
    });
    expect(
      mapAppInfo({ version: "0.1.0", platform: "linux", data_dir: "/d", log_dir: "/l" }),
    ).toEqual({ version: "0.1.0", platform: "linux", dataDir: "/d", logDir: "/l" });
  });
});

// Keep the wire type referenced so the mapper signature is checked against it.
const _wire: WireViewSpec = { kind: "ranking", indicator: "X", year: 2020 };
void _wire;
