/**
 * Stored-view location mapping (S6, D7).
 *
 * A saved view stores a `ViewSpec`, but reopening it must go through the same
 * URL-backed routes as any deep link. These pure functions are the inverse of
 * each other: `locationToViewSpec(viewSpecToLocation(spec))` is the original
 * spec, and an invalid or unrelated location returns `null`.
 */

import {
  indicatorCode,
  isIso3,
  iso3,
  isYear,
  type ViewSpec,
  year,
} from "../../../core/domain/model";
import { validateViewSpec } from "../../../core/domain/view";

/** The two routing fields a hash location exposes. */
export interface ViewLocation {
  readonly pathname: string;
  readonly search: string;
}

const EXPLORE_PREFIX = "/explore/";

function query(location: ViewLocation): URLSearchParams {
  return new URLSearchParams(location.search);
}

function parseYear(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return isYear(value) ? value : null;
}

function parseGeographies(raw: string | null): readonly string[] | null {
  const values = (raw ?? "ECU")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  return values.length === 0 ? null : values;
}

function parseExplore(location: ViewLocation): ViewSpec | null {
  if (!location.pathname.startsWith(EXPLORE_PREFIX)) {
    return null;
  }
  const code = decodeURIComponent(location.pathname.slice(EXPLORE_PREFIX.length));
  if (code === "" || code.includes("/")) {
    return null;
  }
  const params = query(location);
  const geographies = parseGeographies(params.get("g"));
  if (geographies === null) {
    return null;
  }
  const rawTransform = params.get("t");
  const rawChart = params.get("ch");
  const from = parseYear(params.get("from"));
  const to = parseYear(params.get("to"));
  const baseYear = parseYear(params.get("base"));
  return {
    kind: "explore",
    indicator: indicatorCode(code),
    geographies: geographies.map(iso3),
    from: from === null ? null : year(from),
    to: to === null ? null : year(to),
    transform: rawTransform === "yoy" || rawTransform === "index" ? rawTransform : "level",
    baseYear: baseYear === null ? null : year(baseYear),
    chart: rawChart === "area" || rawChart === "bar" ? rawChart : "line",
  };
}

function parseTrajectories(location: ViewLocation): ViewSpec | null {
  if (location.pathname !== "/compare/trajectories") {
    return null;
  }
  const params = query(location);
  const indicators = (params.get("i") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value !== "");
  const geography = (params.get("g") ?? "ECU").trim().toUpperCase();
  if (!isIso3(geography)) {
    return null;
  }
  const baseYear = parseYear(params.get("base"));
  return {
    kind: "trajectories",
    indicators: indicators.map(indicatorCode),
    geography: iso3(geography),
    baseYear: baseYear === null ? null : year(baseYear),
  };
}

function parseRanking(location: ViewLocation): ViewSpec | null {
  if (location.pathname !== "/compare/ranking") {
    return null;
  }
  const params = query(location);
  const indicator = (params.get("i") ?? "").trim();
  const parsedYear = parseYear(params.get("y"));
  if (indicator === "" || parsedYear === null) {
    return null;
  }
  return { kind: "ranking", indicator: indicatorCode(indicator), year: year(parsedYear) };
}

/** Builds the hash location that reopens a saved view. */
export function viewSpecToLocation(spec: ViewSpec): string {
  switch (spec.kind) {
    case "explore": {
      const params = new URLSearchParams();
      if (spec.geographies.join(",") !== "ECU") {
        params.set("g", spec.geographies.join(","));
      }
      if (spec.from !== null) {
        params.set("from", String(spec.from));
      }
      if (spec.to !== null) {
        params.set("to", String(spec.to));
      }
      if (spec.transform !== "level") {
        params.set("t", spec.transform);
      }
      if (spec.baseYear !== null) {
        params.set("base", String(spec.baseYear));
      }
      if (spec.chart !== "line") {
        params.set("ch", spec.chart);
      }
      const search = params.toString();
      return `/explore/${spec.indicator}${search === "" ? "" : `?${search}`}`;
    }
    case "trajectories": {
      const params = new URLSearchParams();
      params.set("i", spec.indicators.join(","));
      params.set("g", spec.geography);
      if (spec.baseYear !== null) {
        params.set("base", String(spec.baseYear));
      }
      return `/compare/trajectories?${params.toString()}`;
    }
    case "ranking": {
      const params = new URLSearchParams();
      params.set("i", spec.indicator);
      params.set("y", String(spec.year));
      return `/compare/ranking?${params.toString()}`;
    }
  }
}

/** Parses a hash location back into a validated view spec, or `null`. */
export function locationToViewSpec(location: ViewLocation): ViewSpec | null {
  const candidate = parseExplore(location) ?? parseTrajectories(location) ?? parseRanking(location);
  if (candidate === null) {
    return null;
  }
  return validateViewSpec(candidate).ok ? candidate : null;
}

/** True when the route can be saved as a view (S6). */
export function isSavableViewPath(pathname: string): boolean {
  return (
    pathname.startsWith(EXPLORE_PREFIX) ||
    pathname === "/compare/trajectories" ||
    pathname === "/compare/ranking"
  );
}
