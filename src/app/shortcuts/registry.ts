/**
 * The single command registry (D26).
 *
 * Every shortcut and every palette action is declared here, then consumed by
 * `use-shortcuts` (the only global keydown listener) and the command palette.
 */

import type { MessageKey } from "../../ui/i18n/en";

/** Keyboard platform used to normalize `Mod`. */
export type Platform = "mac" | "other";

/** Where a command appears in the command palette. */
export type PaletteGroup = "navigation" | "appearance" | "language" | "help" | "actions";

/** Runtime dependencies a command may use when it runs. */
export interface CommandContext {
  readonly platform: Platform;
  readonly pathname: string;
  readonly navigate: (path: string) => void;
  readonly goExplore: () => void;
  readonly openPalette: () => void;
  readonly openShortcuts: () => void;
  readonly toggleTheme: () => void;
  readonly setLanguage: (language: "en" | "es") => void;
  readonly stepIndicator: (delta: 1 | -1) => void;
  readonly canSaveView: boolean;
  readonly openSaveView: () => void;
}

/** A named, translated action with an optional keyboard shortcut. */
export interface Command {
  readonly id: string;
  readonly titleKey: MessageKey;
  /** Extra search terms in both languages (palette ranking). */
  readonly keywords: readonly string[];
  /** Canonical shortcut: `Mod+K`, `?`, `g e`, `[`. */
  readonly shortcut?: string;
  readonly paletteGroup?: PaletteGroup;
  readonly when?: (context: CommandContext) => boolean;
  readonly run: (context: CommandContext) => void;
}

const MODIFIER_ORDER = ["ctrl", "meta", "alt", "shift"] as const;

/** Commands available in this task; T10 registers save and export commands. */
export const COMMANDS: readonly Command[] = [
  {
    id: "open-palette",
    titleKey: "command.openPalette",
    keywords: ["palette", "command", "search", "paleta", "comando", "buscar"],
    shortcut: "Mod+K",
    run: (context) => context.openPalette(),
  },
  {
    id: "go-explore",
    titleKey: "command.goExplore",
    keywords: ["explore", "indicator", "chart", "explorar", "indicador", "grafico"],
    shortcut: "g e",
    paletteGroup: "navigation",
    run: (context) => context.goExplore(),
  },
  {
    id: "go-compare-trajectories",
    titleKey: "command.goTrajectories",
    keywords: ["compare", "trajectories", "trajectory", "comparar", "trayectorias"],
    shortcut: "g c",
    paletteGroup: "navigation",
    run: (context) => context.navigate("/compare/trajectories"),
  },
  {
    id: "go-compare-ranking",
    titleKey: "command.goRanking",
    keywords: ["compare", "ranking", "rank", "comparar", "clasificacion"],
    paletteGroup: "navigation",
    run: (context) => context.navigate("/compare/ranking"),
  },
  {
    id: "go-views",
    titleKey: "command.goViews",
    keywords: ["saved", "views", "bookmarks", "guardadas", "vistas"],
    shortcut: "g v",
    paletteGroup: "navigation",
    run: (context) => context.navigate("/views"),
  },
  {
    id: "go-settings",
    titleKey: "command.goSettings",
    keywords: ["settings", "preferences", "ajustes", "preferencias"],
    shortcut: "g s",
    paletteGroup: "navigation",
    run: (context) => context.navigate("/settings"),
  },
  {
    id: "go-about",
    titleKey: "command.goAbout",
    keywords: ["about", "data", "license", "acerca", "datos", "licencia"],
    paletteGroup: "navigation",
    run: (context) => context.navigate("/about"),
  },
  {
    id: "toggle-theme",
    titleKey: "command.toggleTheme",
    keywords: ["theme", "dark", "light", "tema", "oscuro", "claro"],
    shortcut: "Mod+Shift+D",
    paletteGroup: "appearance",
    run: (context) => context.toggleTheme(),
  },
  {
    id: "switch-language-en",
    titleKey: "command.langEnglish",
    keywords: ["english", "language", "ingles", "idioma"],
    paletteGroup: "language",
    run: (context) => context.setLanguage("en"),
  },
  {
    id: "switch-language-es",
    titleKey: "command.langSpanish",
    keywords: ["spanish", "espanol", "language", "idioma"],
    paletteGroup: "language",
    run: (context) => context.setLanguage("es"),
  },
  {
    id: "show-shortcuts",
    titleKey: "command.showShortcuts",
    keywords: ["shortcuts", "keyboard", "help", "atajos", "teclado", "ayuda"],
    shortcut: "?",
    paletteGroup: "help",
    run: (context) => context.openShortcuts(),
  },
  {
    id: "save-view",
    titleKey: "command.saveView",
    keywords: ["save", "view", "bookmark", "guardar", "vista"],
    shortcut: "Mod+S",
    paletteGroup: "actions",
    when: (context) => context.canSaveView,
    run: (context) => context.openSaveView(),
  },
  {
    id: "previous-indicator",
    titleKey: "command.previousIndicator",
    keywords: ["previous", "indicator", "anterior", "indicador"],
    shortcut: "[",
    when: (context) => context.pathname.startsWith("/explore"),
    run: (context) => context.stepIndicator(-1),
  },
  {
    id: "next-indicator",
    titleKey: "command.nextIndicator",
    keywords: ["next", "indicator", "siguiente", "indicador"],
    shortcut: "]",
    when: (context) => context.pathname.startsWith("/explore"),
    run: (context) => context.stepIndicator(1),
  },
];

/** Finds a command by its stable id. */
export function commandById(id: string): Command | undefined {
  return COMMANDS.find((command) => command.id === id);
}

/** Commands whose `when` predicate accepts the current context. */
export function availableCommands(context: CommandContext): Command[] {
  return COMMANDS.filter((command) => command.when?.(context) ?? true);
}

/** Splits a canonical shortcut into its strokes (`g e` -> `["g", "e"]`). */
export function parseShortcut(shortcut: string): string[] {
  return shortcut
    .trim()
    .split(/\s+/)
    .filter((stroke) => stroke !== "");
}

function resolveStroke(stroke: string, platform: Platform): string {
  const modifiers = new Set<string>();
  let key = "";
  for (const token of stroke.split("+")) {
    switch (token) {
      case "Mod":
        modifiers.add(platform === "mac" ? "meta" : "ctrl");
        break;
      case "Ctrl":
        modifiers.add("ctrl");
        break;
      case "Cmd":
      case "Meta":
        modifiers.add("meta");
        break;
      case "Alt":
        modifiers.add("alt");
        break;
      case "Shift":
        modifiers.add("shift");
        break;
      default:
        key = token;
    }
  }
  const ordered = MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier));
  return [...ordered, key.toLowerCase()].join("+");
}

/** Resolves a canonical shortcut (`Mod+K`) to the platform-specific stroke. */
export function resolveShortcut(shortcut: string, platform: Platform): string {
  return parseShortcut(shortcut)
    .map((stroke) => resolveStroke(stroke, platform))
    .join(" ");
}

const MAC_LABELS: Readonly<Record<string, string>> = {
  ctrl: "⌃",
  meta: "⌘",
  alt: "⌥",
  shift: "⇧",
};

const PC_LABELS: Readonly<Record<string, string>> = {
  ctrl: "Ctrl",
  meta: "Meta",
  alt: "Alt",
  shift: "Shift",
};

function formatStroke(stroke: string, platform: Platform): string {
  const labels = platform === "mac" ? MAC_LABELS : PC_LABELS;
  const tokens = stroke.split("+");
  const parts: string[] = [];
  let key = "";
  for (const token of tokens) {
    if (token === "Mod") {
      parts.push(platform === "mac" ? "⌘" : "Ctrl");
    } else if (token === "Ctrl") {
      parts.push(labels.ctrl ?? "Ctrl");
    } else if (token === "Cmd" || token === "Meta") {
      parts.push(labels.meta ?? "Meta");
    } else if (token === "Alt") {
      parts.push(labels.alt ?? "Alt");
    } else if (token === "Shift") {
      parts.push(labels.shift ?? "Shift");
    } else {
      key = token;
    }
  }
  const keyLabel = parts.length > 0 && key.length === 1 ? key.toUpperCase() : key;
  return platform === "mac" ? `${parts.join("")}${keyLabel}` : [...parts, keyLabel].join("+");
}

/** Formats a canonical shortcut for display (`Mod+K` -> `Ctrl+K`/`⌘K`). */
export function formatShortcut(shortcut: string, platform: Platform): string {
  return parseShortcut(shortcut)
    .map((stroke) => formatStroke(stroke, platform))
    .join(" ");
}

/** Detects the keyboard platform from a user agent. */
export function detectPlatform(userAgent: string): Platform {
  return /mac/i.test(userAgent) ? "mac" : "other";
}
