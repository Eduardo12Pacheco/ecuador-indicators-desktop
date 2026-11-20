/**
 * Explore page state backed by URL search parameters (D7).
 *
 * The route path owns the selected indicator (`#/explore/:code`); the search
 * string owns geographies, range, transform, base year and chart type. Parsing
 * is delegated to the pure, sanitizing `parseExploreState`.
 */

import { useCallback, useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router";

import type { Catalog } from "../../../core/domain/model";
import {
  DEFAULT_INDICATOR as CORE_DEFAULT_INDICATOR,
  type ExploreState,
  parseExploreState,
  serializeExploreState,
} from "../../../core/domain/view-state";

/** Controller returned by {@link useExploreState}. */
export interface ExploreStateController {
  /** Sanitized state, or `null` until the catalog has loaded. */
  readonly state: ExploreState | null;
  /** Merges a patch, re-sanitizes and pushes the new URL. */
  readonly update: (patch: Partial<ExploreState>) => void;
}

/** Reads and writes Explore state through the hash router. */
export function useExploreState(catalog: Catalog | null): ExploreStateController {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const routeCode = params.code;
  const state = useMemo(() => {
    if (catalog === null) {
      return null;
    }
    const combined = new URLSearchParams(location.search);
    combined.set("i", routeCode ?? CORE_DEFAULT_INDICATOR);
    return parseExploreState(combined, catalog);
  }, [catalog, location.search, routeCode]);

  const update = useCallback(
    (patch: Partial<ExploreState>) => {
      if (catalog === null || state === null) {
        return;
      }
      const combined = new URLSearchParams(location.search);
      combined.set("i", routeCode ?? CORE_DEFAULT_INDICATOR);
      const current = parseExploreState(combined, catalog);
      const next: ExploreState = { ...current, ...patch };
      const search = new URLSearchParams(serializeExploreState(next));
      search.delete("i");
      const query = search.toString();
      navigate(`/explore/${next.indicator}${query === "" ? "" : `?${query}`}`, { replace: true });
    },
    [catalog, location.search, navigate, routeCode, state],
  );

  return { state, update };
}
