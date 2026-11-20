/**
 * Compare page state backed by URL search parameters (D7).
 *
 * Trajectories own `i` (comma-separated indicators), `g` (geography) and
 * `base`; ranking owns `i` and `y`. Parsing is total and sanitizing so a stale
 * or hand-edited link never asks the use cases for an invalid selection.
 */

import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

import {
  type Catalog,
  type IndicatorCode,
  type Iso3,
  indicatorCode,
  iso3,
  isYear,
  type Year,
} from "../../../core/domain/model";

/** Indicators used when the trajectory URL carries no selection. */
export const DEFAULT_TRAJECTORY_INDICATORS: readonly IndicatorCode[] = [
  indicatorCode("NY.GDP.MKTP.CD"),
  indicatorCode("FP.CPI.TOTL.ZG"),
];

/** Indicator used when the ranking URL carries no selection. */
export const DEFAULT_RANKING_INDICATOR = indicatorCode("NY.GDP.MKTP.CD");

/** Minimum and maximum trajectory series (S4). */
export const MIN_TRAJECTORY_INDICATORS = 2;
export const MAX_TRAJECTORY_INDICATORS = 4;

/** Default geography of both tabs. */
export const DEFAULT_COMPARE_GEOGRAPHY = iso3("ECU");

/** Canonical compare routes. */
export const TRAJECTORIES_PATH = "/compare/trajectories";
export const RANKING_PATH = "/compare/ranking";

/** Normalized trajectories state. */
export interface TrajectoriesState {
  readonly indicators: readonly IndicatorCode[];
  readonly geography: Iso3;
  readonly baseYear: Year | null;
}

/** Normalized ranking state; `year === null` means "use the data default". */
export interface RankingState {
  readonly indicator: IndicatorCode;
  readonly year: Year | null;
}

function parseYear(raw: string | null): Year | null {
  if (raw === null || !/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  return isYear(value) ? value : null;
}

function matchIndicator(catalog: Catalog, raw: string): IndicatorCode | null {
  const normalized = raw.trim().toLowerCase();
  const match = catalog.indicators.find((indicator) => indicator.code.toLowerCase() === normalized);
  return match === undefined ? null : indicatorCode(match.code);
}

function defaultIndicators(catalog: Catalog): IndicatorCode[] {
  const known = new Set(catalog.indicators.map((indicator) => indicator.code));
  const preferred = DEFAULT_TRAJECTORY_INDICATORS.filter((code) => known.has(code));
  const ordered = [
    ...preferred,
    ...catalog.indicators.map((indicator) => indicatorCode(indicator.code)),
  ];
  return [...new Set(ordered)];
}

function sanitizeIndicators(raw: string | null, catalog: Catalog): IndicatorCode[] {
  const requested: IndicatorCode[] = [];
  for (const part of (raw ?? "").split(",")) {
    if (part.trim() === "") {
      continue;
    }
    const matched = matchIndicator(catalog, part);
    if (matched !== null && !requested.includes(matched)) {
      requested.push(matched);
    }
  }
  const filled = [...requested];
  for (const candidate of defaultIndicators(catalog)) {
    if (filled.length >= MIN_TRAJECTORY_INDICATORS) {
      break;
    }
    if (!filled.includes(candidate)) {
      filled.push(candidate);
    }
  }
  return filled.slice(0, MAX_TRAJECTORY_INDICATORS);
}

function sanitizeGeography(raw: string | null, catalog: Catalog): Iso3 {
  const normalized = (raw ?? "").trim().toUpperCase();
  const match = catalog.geographies.find((geography) => geography.iso3 === normalized);
  return match?.iso3 ?? catalog.geographies[0]?.iso3 ?? DEFAULT_COMPARE_GEOGRAPHY;
}

/** Parses and sanitizes trajectories state from URL search parameters. */
export function parseTrajectoriesState(
  params: { get(name: string): string | null },
  catalog: Catalog,
): TrajectoriesState {
  return {
    indicators: sanitizeIndicators(params.get("i"), catalog),
    geography: sanitizeGeography(params.get("g"), catalog),
    baseYear: parseYear(params.get("base")),
  };
}

/** Serializes trajectories state, omitting defaults. */
export function serializeTrajectoriesState(state: TrajectoriesState): string {
  const parts: string[] = [];
  if (state.indicators.join(",") !== DEFAULT_TRAJECTORY_INDICATORS.join(",")) {
    parts.push(`i=${state.indicators.join(",")}`);
  }
  if (state.geography !== DEFAULT_COMPARE_GEOGRAPHY) {
    parts.push(`g=${state.geography}`);
  }
  if (state.baseYear !== null) {
    parts.push(`base=${state.baseYear}`);
  }
  return parts.join("&");
}

/** Parses and sanitizes ranking state from URL search parameters. */
export function parseRankingState(
  params: { get(name: string): string | null },
  catalog: Catalog,
): RankingState {
  const requested = params.get("i");
  const indicator = requested === null ? null : matchIndicator(catalog, requested);
  return {
    indicator:
      indicator ??
      (catalog.indicators.some((candidate) => candidate.code === DEFAULT_RANKING_INDICATOR)
        ? DEFAULT_RANKING_INDICATOR
        : catalog.indicators[0] === undefined
          ? DEFAULT_RANKING_INDICATOR
          : indicatorCode(catalog.indicators[0].code)),
    year: parseYear(params.get("y")),
  };
}

/** Serializes ranking state, omitting defaults. */
export function serializeRankingState(state: RankingState): string {
  const parts: string[] = [];
  if (state.indicator !== DEFAULT_RANKING_INDICATOR) {
    parts.push(`i=${state.indicator}`);
  }
  if (state.year !== null) {
    parts.push(`y=${state.year}`);
  }
  return parts.join("&");
}

/** Controller returned by {@link useTrajectoriesState}. */
export interface TrajectoriesStateController {
  readonly state: TrajectoriesState | null;
  readonly update: (patch: Partial<TrajectoriesState>) => void;
}

/** Reads and writes trajectories state through the hash router. */
export function useTrajectoriesState(catalog: Catalog | null): TrajectoriesStateController {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(
    () =>
      catalog === null
        ? null
        : parseTrajectoriesState(new URLSearchParams(location.search), catalog),
    [catalog, location.search],
  );
  const update = useCallback(
    (patch: Partial<TrajectoriesState>) => {
      if (state === null) {
        return;
      }
      const query = serializeTrajectoriesState({ ...state, ...patch });
      navigate(`${TRAJECTORIES_PATH}${query === "" ? "" : `?${query}`}`, { replace: true });
    },
    [navigate, state],
  );
  return { state, update };
}

/** Controller returned by {@link useRankingState}. */
export interface RankingStateController {
  readonly state: RankingState | null;
  readonly update: (patch: Partial<RankingState>) => void;
}

/** Reads and writes ranking state through the hash router. */
export function useRankingState(catalog: Catalog | null): RankingStateController {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(
    () =>
      catalog === null ? null : parseRankingState(new URLSearchParams(location.search), catalog),
    [catalog, location.search],
  );
  const update = useCallback(
    (patch: Partial<RankingState>) => {
      if (state === null) {
        return;
      }
      const query = serializeRankingState({ ...state, ...patch });
      navigate(`${RANKING_PATH}${query === "" ? "" : `?${query}`}`, { replace: true });
    },
    [navigate, state],
  );
  return { state, update };
}
