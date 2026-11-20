import { assert, constantFrom, oneof, property, record, uniqueArray } from "fast-check";
import { describe, expect, it } from "vitest";

import { indicatorCode, iso3, type ViewSpec, year } from "../../../core/domain/model";
import { validateViewSpec } from "../../../core/domain/view";
import { isSavableViewPath, locationToViewSpec, viewSpecToLocation } from "./view-location";

const YEAR = constantFrom(1900, 1960, 2000, 2020, 2100);
const TRANSFORM = constantFrom("level" as const, "yoy" as const, "index" as const);
const CHART = constantFrom("line" as const, "area" as const, "bar" as const);
const CODE = constantFrom("NY.GDP.MKTP.CD", "FP.CPI.TOTL.ZG", "SP.POP.TOTL", "SI.POV.NAHC");
const GEOGRAPHY = constantFrom("ECU", "COL", "PER", "CHL", "BOL", "LCN", "WLD");

const exploreSpec = record({
  kind: constantFrom("explore" as const),
  indicator: CODE,
  peers: uniqueArray(GEOGRAPHY, { maxLength: 4 }),
  from: constantFrom(null, 1990, 2000, 2010),
  to: constantFrom(null, 2000, 2010, 2020),
  transform: TRANSFORM,
  baseYear: constantFrom(null, 1990, 2000),
  chart: CHART,
}).map((raw): ViewSpec => {
  let from: number | null = raw.from;
  let to: number | null = raw.to;
  if (from !== null && to !== null && from > to) {
    [from, to] = [to, from];
  }
  return {
    kind: "explore",
    indicator: indicatorCode(raw.indicator),
    geographies: [iso3("ECU"), ...raw.peers.filter((code) => code !== "ECU").map(iso3)].slice(0, 5),
    from: from === null ? null : year(from),
    to: to === null ? null : year(to),
    transform: raw.transform,
    baseYear: raw.baseYear === null ? null : year(raw.baseYear),
    chart: raw.chart,
  };
});

const trajectoriesSpec = record({
  kind: constantFrom("trajectories" as const),
  indicators: uniqueArray(CODE, { minLength: 2, maxLength: 4 }),
  geography: GEOGRAPHY,
  baseYear: constantFrom(null, 1990, 2000, 2020),
}).map(
  (raw): ViewSpec => ({
    kind: "trajectories",
    indicators: raw.indicators.map(indicatorCode),
    geography: iso3(raw.geography),
    baseYear: raw.baseYear === null ? null : year(raw.baseYear),
  }),
);

const rankingSpec = record({
  kind: constantFrom("ranking" as const),
  indicator: CODE,
  year: YEAR,
}).map(
  (raw): ViewSpec => ({
    kind: "ranking",
    indicator: indicatorCode(raw.indicator),
    year: year(raw.year),
  }),
);

const anySpec = oneof(exploreSpec, trajectoriesSpec, rankingSpec);

function parse(location: string) {
  const url = new URL(location, "https://app.local");
  return locationToViewSpec({ pathname: url.pathname, search: url.search });
}

describe("view location round-trip", () => {
  it("restores every generated valid explore spec", () => {
    assert(
      property(exploreSpec, (spec) => {
        const restored = parse(viewSpecToLocation(spec));
        return JSON.stringify(restored) === JSON.stringify(spec);
      }),
      { seed: 41, numRuns: 120 },
    );
  });

  it("restores generated trajectories and ranking specs exactly", () => {
    assert(
      property(
        oneof(trajectoriesSpec, rankingSpec),
        (spec) => JSON.stringify(parse(viewSpecToLocation(spec))) === JSON.stringify(spec),
      ),
      { seed: 42, numRuns: 120 },
    );
  });

  it("rejects unknown routes and invalid specs", () => {
    expect(parse("/settings")).toBeNull();
    expect(parse("/compare")).toBeNull();
    expect(parse("/explore/")).toBeNull();
    expect(parse("/compare/trajectories?i=ONE")).toBeNull();
    expect(parse("/compare/ranking?i=NY.GDP.MKTP.CD")).toBeNull();
    expect(parse("/compare/ranking?i=NY.GDP.MKTP.CD&y=1800")).toBeNull();
    expect(parse("/explore/ABC?from=2020&to=2010")).toBeNull();
    expect(parse("/explore/ABC?g=ECU,ECU")).toBeNull();
  });

  it("recognizes the three savable routes", () => {
    expect(isSavableViewPath("/explore/NY.GDP.MKTP.CD")).toBe(true);
    expect(isSavableViewPath("/compare/trajectories")).toBe(true);
    expect(isSavableViewPath("/compare/ranking")).toBe(true);
    expect(isSavableViewPath("/views")).toBe(false);
    expect(isSavableViewPath("/settings")).toBe(false);
  });

  it("keeps a validated spec valid after a round-trip", () => {
    assert(
      property(anySpec, (spec) => {
        const restored = parse(viewSpecToLocation(spec));
        return restored !== null && validateViewSpec(restored).ok;
      }),
      { seed: 43, numRuns: 100 },
    );
  });
});
