/**
 * Async palette data: ranked catalog search, saved views and actions.
 *
 * The hook owns all grouping and scoring so the component only renders and
 * dispatches the selected item.
 */

import { useQuery } from "@tanstack/react-query";

import {
  type SearchEverythingResult,
  searchEverything,
} from "../../../core/application/use-cases/search-everything";
import {
  geographyName,
  indicatorName,
  type Lang,
  type SavedView,
} from "../../../core/domain/model";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import { type PaletteCommand, toSearchActions } from "./commands";

/** Palette group identifiers, in display order. */
export type PaletteGroupId = "indicators" | "geographies" | "views" | "actions";

/** One selectable palette row. */
export type PaletteItem =
  | {
      readonly kind: "indicator";
      readonly id: string;
      readonly label: string;
      readonly detail: string;
      readonly code: string;
    }
  | {
      readonly kind: "geography";
      readonly id: string;
      readonly label: string;
      readonly detail: string;
      readonly iso3: string;
    }
  | {
      readonly kind: "view";
      readonly id: string;
      readonly label: string;
      readonly detail: string;
      readonly view: SavedView;
    }
  | {
      readonly kind: "action";
      readonly id: string;
      readonly label: string;
      readonly detail: string;
      readonly commandId: string;
    };

/** A rendered palette group. */
export interface PaletteGroupResult {
  readonly id: PaletteGroupId;
  readonly title: string;
  readonly items: readonly PaletteItem[];
}

/** Result of {@link usePaletteItems}. */
export interface PaletteItems {
  readonly groups: readonly PaletteGroupResult[];
  readonly count: number;
  readonly isPending: boolean;
  readonly error: string | null;
}

/** Inputs for {@link usePaletteItems}. */
export interface UsePaletteItemsOptions {
  readonly query: string;
  readonly commands: readonly PaletteCommand[];
  readonly lang: Lang;
}

function actionItems(commands: readonly PaletteCommand[]): PaletteItem[] {
  return commands.map((command) => ({
    kind: "action",
    id: `action:${command.id}`,
    label: command.title,
    detail: command.detail ?? "",
    commandId: command.id,
  }));
}

function groupItems(
  result: SearchEverythingResult,
  commands: readonly PaletteCommand[],
  lang: Lang,
  titles: Readonly<Record<PaletteGroupId, string>>,
): PaletteGroupResult[] {
  const commandById = new Map(commands.map((command) => [command.id, command]));
  const indicators: PaletteItem[] = result.indicators.map((hit) => ({
    kind: "indicator",
    id: `indicator:${hit.indicator.code}`,
    label: indicatorName(hit.indicator, lang),
    detail: hit.indicator.code,
    code: hit.indicator.code,
  }));
  const geographies: PaletteItem[] = result.geographies.map((hit) => ({
    kind: "geography",
    id: `geography:${hit.geography.iso3}`,
    label: geographyName(hit.geography, lang),
    detail: hit.geography.iso3,
    iso3: hit.geography.iso3,
  }));
  const views: PaletteItem[] = result.views.map((hit) => ({
    kind: "view",
    id: `view:${hit.view.id}`,
    label: hit.view.name,
    detail: hit.view.spec.kind,
    view: hit.view,
  }));
  const actions: PaletteItem[] = [];
  for (const hit of result.actions) {
    const command = commandById.get(hit.id);
    if (command !== undefined) {
      actions.push({
        kind: "action",
        id: `action:${command.id}`,
        label: command.title,
        detail: command.detail ?? "",
        commandId: command.id,
      });
    }
  }
  return [
    { id: "indicators" as const, title: titles.indicators, items: indicators },
    { id: "geographies" as const, title: titles.geographies, items: geographies },
    { id: "views" as const, title: titles.views, items: views },
    { id: "actions" as const, title: titles.actions, items: actions },
  ].filter((group) => group.items.length > 0);
}

/** Builds the grouped palette content for the current query. */
export function usePaletteItems({ query, commands, lang }: UsePaletteItemsOptions): PaletteItems {
  const ports = usePorts();
  const { t } = useT();
  const trimmed = query.trim();
  const titles: Record<PaletteGroupId, string> = {
    indicators: t("palette.group.indicators"),
    geographies: t("palette.group.geographies"),
    views: t("palette.group.views"),
    actions: t("palette.group.actions"),
  };

  const search = useQuery({
    queryKey: ["palette", "search", trimmed, lang, commands.map((command) => command.id).join(",")],
    enabled: trimmed !== "",
    queryFn: () =>
      searchEverything(
        { dataset: ports.dataset, views: ports.views },
        { query: trimmed, lang, actions: toSearchActions(commands) },
      ),
  });

  if (trimmed === "") {
    const items = actionItems(commands);
    return {
      groups: items.length === 0 ? [] : [{ id: "actions" as const, title: titles.actions, items }],
      count: items.length,
      isPending: false,
      error: null,
    };
  }

  const data = search.data;
  if (data !== undefined && !data.ok) {
    return { groups: [], count: 0, isPending: false, error: data.error.message };
  }
  const groups = data?.ok ? groupItems(data.value, commands, lang, titles) : [];
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  return { groups, count, isPending: search.isPending, error: null };
}
