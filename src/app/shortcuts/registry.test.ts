import { describe, expect, it } from "vitest";

import type { CommandContext } from "./registry";
import {
  availableCommands,
  COMMANDS,
  commandById,
  detectPlatform,
  formatShortcut,
  parseShortcut,
  resolveShortcut,
} from "./registry";

function context(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    platform: "other",
    pathname: "/explore/NY.GDP.MKTP.CD",
    navigate: () => undefined,
    goExplore: () => undefined,
    openPalette: () => undefined,
    openShortcuts: () => undefined,
    toggleTheme: () => undefined,
    setLanguage: () => undefined,
    stepIndicator: () => undefined,
    ...overrides,
  };
}

describe("command registry", () => {
  it("registers unique command ids", () => {
    const ids = COMMANDS.map((command) => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("declares only well-formed one- or two-stroke shortcuts", () => {
    for (const command of COMMANDS) {
      if (command.shortcut === undefined) {
        continue;
      }
      const strokes = parseShortcut(command.shortcut);
      expect(strokes.length).toBeGreaterThanOrEqual(1);
      expect(strokes.length).toBeLessThanOrEqual(2);
      for (const stroke of strokes) {
        expect(stroke.trim()).not.toBe("");
        expect(stroke).not.toContain("++");
      }
    }
  });

  it("finds commands by id", () => {
    expect(commandById("open-palette")?.shortcut).toBe("Mod+K");
    expect(commandById("missing")).toBeUndefined();
  });

  it("hides indicator stepping outside Explore", () => {
    const explore = availableCommands(context()).map((command) => command.id);
    expect(explore).toContain("previous-indicator");
    expect(explore).toContain("next-indicator");
    const settings = availableCommands(context({ pathname: "/settings" })).map(
      (command) => command.id,
    );
    expect(settings).not.toContain("previous-indicator");
  });

  it("registers every command with a title key", () => {
    for (const command of COMMANDS) {
      expect(command.titleKey).toMatch(/^command\./);
    }
  });
});

describe("shortcut normalization", () => {
  it("maps Mod to Meta on macOS and Control elsewhere", () => {
    expect(resolveShortcut("Mod+K", "mac")).toBe("meta+k");
    expect(resolveShortcut("Mod+K", "other")).toBe("ctrl+k");
    expect(resolveShortcut("Mod+Shift+D", "mac")).toBe("meta+shift+d");
    expect(resolveShortcut("Mod+Shift+D", "other")).toBe("ctrl+shift+d");
    expect(resolveShortcut("g", "mac")).toBe("g");
    expect(resolveShortcut("?", "other")).toBe("?");
  });

  it("splits chords and formats them per platform", () => {
    expect(parseShortcut("g e")).toEqual(["g", "e"]);
    expect(parseShortcut("Mod+K")).toEqual(["Mod+K"]);
    expect(formatShortcut("Mod+K", "mac")).toBe("⌘K");
    expect(formatShortcut("Mod+K", "other")).toBe("Ctrl+K");
    expect(formatShortcut("Mod+Shift+D", "other")).toBe("Ctrl+Shift+D");
    expect(formatShortcut("g e", "other")).toBe("g e");
  });

  it("detects macOS from the user agent", () => {
    expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("mac");
    expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
  });
});
