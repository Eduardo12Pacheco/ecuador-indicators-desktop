/**
 * Command-palette search across indicators, geographies, saved views and
 * actions (S5). Ranking is deterministic and reuses {@link searchCatalog}.
 */

import type { Geography, Lang, SavedView } from "../../domain/model";
import { ok, type Result } from "../../domain/result";
import { normalizeText, type SearchHit, searchCatalog } from "../../domain/search";
import type { DatasetRepository, ViewRepository } from "../ports";
import { loadCatalog } from "./load-catalog";

/** A registered command the palette can surface. */
export interface SearchAction {
  readonly id: string;
  readonly keywords: readonly string[];
}

/** A scored geography hit. */
export interface GeographyHit {
  readonly geography: Geography;
  readonly score: number;
}

/** A scored saved-view hit. */
export interface ViewHit {
  readonly view: SavedView;
  readonly score: number;
}

/** A scored action hit. */
export interface ActionHit {
  readonly id: string;
  readonly score: number;
}

/** The grouped palette result. */
export interface SearchEverythingResult {
  readonly indicators: readonly SearchHit[];
  readonly geographies: readonly GeographyHit[];
  readonly views: readonly ViewHit[];
  readonly actions: readonly ActionHit[];
}

/** Inputs for {@link searchEverything}. */
export interface SearchEverythingRequest {
  readonly query: string;
  readonly lang: Lang;
  readonly actions?: readonly SearchAction[];
}

function scoreGeography(query: string, geography: Geography, lang: Lang): number {
  if (normalizeText(geography.iso3) === query) {
    return 100;
  }
  const name = normalizeText(lang === "es" ? geography.nameEs : geography.nameEn);
  if (name.split(" ").some((token) => token.startsWith(query))) {
    return 80;
  }
  return name.includes(query) ? 60 : 0;
}

function scoreView(query: string, view: SavedView): number {
  const name = normalizeText(view.name);
  if (name.split(" ").some((token) => token.startsWith(query))) {
    return 80;
  }
  return name.includes(query) ? 60 : 0;
}

/** Searches everything the palette needs in one call. */
export async function searchEverything(
  deps: { readonly dataset: DatasetRepository; readonly views: ViewRepository },
  request: SearchEverythingRequest,
): Promise<Result<SearchEverythingResult>> {
  const query = normalizeText(request.query);
  if (query === "") {
    return ok({ indicators: [], geographies: [], views: [], actions: [] });
  }
  const catalog = await loadCatalog(deps.dataset);
  if (!catalog.ok) {
    return catalog;
  }
  const views = await deps.views.list();
  if (!views.ok) {
    return views;
  }
  const indicators = searchCatalog(query, catalog.value, request.lang);
  const geographies: GeographyHit[] = [];
  for (const geography of catalog.value.geographies) {
    const score = scoreGeography(query, geography, request.lang);
    if (score > 0) {
      geographies.push({ geography, score });
    }
  }
  geographies.sort((left, right) =>
    left.score === right.score
      ? left.geography.sortOrder - right.geography.sortOrder
      : right.score - left.score,
  );
  const viewHits: ViewHit[] = [];
  for (const view of views.value) {
    const score = scoreView(query, view);
    if (score > 0) {
      viewHits.push({ view, score });
    }
  }
  viewHits.sort((left, right) =>
    left.score === right.score
      ? right.view.updatedAt - left.view.updatedAt
      : right.score - left.score,
  );
  const actions: ActionHit[] = [];
  for (const action of request.actions ?? []) {
    let score = 0;
    for (const keyword of action.keywords) {
      const normalized = normalizeText(keyword);
      if (normalized === query) {
        score = Math.max(score, 100);
      } else if (normalized.split(" ").some((token) => token.startsWith(query))) {
        score = Math.max(score, 80);
      } else if (normalized.includes(query)) {
        score = Math.max(score, 60);
      }
    }
    if (score > 0) {
      actions.push({ id: action.id, score });
    }
  }
  actions.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return ok({ indicators, geographies, views: viewHits, actions });
}
