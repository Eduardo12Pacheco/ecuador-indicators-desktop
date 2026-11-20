/**
 * Palette-facing command shape and saved-view routing.
 *
 * The command registry lives in `src/app/shortcuts`; the UI layer receives
 * already translated commands so it never imports the composition root.
 */

import type { SearchAction } from "../../../core/application/use-cases/search-everything";
import type { ViewSpec } from "../../../core/domain/model";
import { viewSpecToLocation } from "../views/view-location";

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
  return viewSpecToLocation(spec);
}
