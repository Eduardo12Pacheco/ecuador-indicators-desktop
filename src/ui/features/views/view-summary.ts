/**
 * Human-readable summaries for saved view cards and the save dialog (S6).
 *
 * Pure so both the page and the dialog use the same wording and so the
 * 80-character name limit is enforced before the adapter validates it.
 */

import type { Catalog } from "../../../core/domain/model";
import {
  findGeography,
  findIndicator,
  geographyName,
  indicatorName,
  type Lang,
  type SavedView,
  type ViewSpec,
} from "../../../core/domain/model";
import { MAX_NAME_CHARS } from "../../../core/domain/view";

/** i18n key for a view-kind badge. */
export type ViewKindKey = "views.kind.explore" | "views.kind.trajectories" | "views.kind.ranking";

/** Returns the badge key for a stored view. */
export function viewKindKey(view: SavedView): ViewKindKey {
  switch (view.spec.kind) {
    case "explore":
      return "views.kind.explore";
    case "trajectories":
      return "views.kind.trajectories";
    case "ranking":
      return "views.kind.ranking";
  }
}

function indicatorLabel(catalog: Catalog, code: string, lang: Lang): string {
  const indicator = findIndicator(catalog, code);
  return indicator === undefined ? code : indicatorName(indicator, lang);
}

function geographyLabel(catalog: Catalog, code: string, lang: Lang): string {
  const geography = findGeography(catalog, code);
  return geography === undefined ? code : geographyName(geography, lang);
}

/** One-line description of what a view reopens, in the active language. */
export function describeViewSpec(spec: ViewSpec, catalog: Catalog, lang: Lang): string {
  switch (spec.kind) {
    case "explore": {
      const names = spec.geographies.map((code) => geographyLabel(catalog, code, lang));
      return [indicatorLabel(catalog, spec.indicator, lang), names.join(", ")].join(" · ");
    }
    case "trajectories": {
      const names = spec.indicators.map((code) => indicatorLabel(catalog, code, lang));
      return [...names, geographyLabel(catalog, spec.geography, lang)].join(" · ");
    }
    case "ranking":
      return [indicatorLabel(catalog, spec.indicator, lang), String(spec.year)].join(" · ");
  }
}

/** A prefilled, valid view name derived from the current page state. */
export function defaultViewName(spec: ViewSpec, catalog: Catalog, lang: Lang): string {
  const summary = describeViewSpec(spec, catalog, lang);
  const characters = [...summary];
  if (characters.length <= MAX_NAME_CHARS) {
    return summary;
  }
  return `${characters.slice(0, MAX_NAME_CHARS - 1).join("")}…`;
}
