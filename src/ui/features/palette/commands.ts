/**
 * Palette-facing command shape and saved-view routing.
 *
 * The command registry lives in `src/app/shortcuts`; the UI layer receives
 * already translated commands so it never imports the composition root.
 */

import type { SearchAction } from "../../../core/application/use-cases/search-everything";
import type { ViewSpec } from "../../../core/domain/model";
import { serializeExploreState } from "../../../core/domain/view-state";

/** A translated command the palette can list and search. */
export interface PaletteCommand {
  readonly id: string;
  readonly title: string;
  readonly keywords: readonly string[];
  /** Shortcut hint, already formatted for the current platform. */
  readonly detail?: string;
}

/** Turns commands into the action input of `searchEverything`. */
export function toSearchActions(commands: readonly PaletteCommand[]): SearchAction[] {
  return commands.map((command) => ({
    id: command.id,
    keywords: [command.title, ...command.keywords],
  }));
}

/** Hash location that reopens a saved view exactly (S6). */
export function viewSpecPath(spec: ViewSpec): string {
  switch (spec.kind) {
    case "explore": {
      const query = serializeExploreState({
        indicator: spec.indicator,
        geographies: spec.geographies,
        from: spec.from,
        to: spec.to,
        transform: spec.transform,
        baseYear: spec.baseYear,
        chart: spec.chart,
      });
      return `/explore/${spec.indicator}${query === "" ? "" : `?${query}`}`;
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
