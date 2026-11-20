/**
 * Design-system contract test (S10 / D9).
 *
 * The tokens live in CSS because that is what ships; this suite parses that
 * file and fails when a binding value drifts or a WCAG pair drops below its
 * documented threshold. Values and ratios come from D9, not from taste.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "tokens.css"), "utf8");

function extractBlock(source: string, selector: string): string {
  const start = source.indexOf(selector);
  if (start < 0) {
    throw new Error(`selector ${selector} not found`);
  }
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`unbalanced block for ${selector}`);
}

function parseVariables(block: string): Map<string, string> {
  const variables = new Map<string, string>();
  for (const match of block.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2]?.trim();
    if (name !== undefined && value !== undefined) {
      variables.set(name, value);
    }
  }
  return variables;
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match?.[1]) throw new Error(`not a six-digit hex colour: ${hex}`);
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function channel(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function color(tokens: Map<string, string>, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`missing token --${name}`);
  return value;
}

function expectRatio(
  tokens: Map<string, string>,
  foreground: string,
  background: string,
  minimum: number,
): void {
  const ratio = contrast(color(tokens, foreground), color(tokens, background));
  expect(
    ratio,
    `--${foreground} on --${background} is ${ratio.toFixed(2)}, needs >= ${minimum}`,
  ).toBeGreaterThanOrEqual(minimum);
}

const light = parseVariables(extractBlock(CSS, ":root {"));
const dark = new Map([...light, ...parseVariables(extractBlock(CSS, ':root[data-theme="dark"]'))]);
const mediaDark = parseVariables(extractBlock(CSS, ":root:not([data-theme])"));

const COLOR_TOKENS = [
  "color-bg",
  "color-surface",
  "color-surface-2",
  "color-border",
  "color-border-strong",
  "color-text",
  "color-text-muted",
  "color-primary",
  "color-primary-hover",
  "color-on-primary",
  "color-danger",
  "color-success",
  "color-warning",
  "color-accent",
  "color-on-accent",
  "focus-ring",
  "series-1",
  "series-2",
  "series-3",
  "series-4",
  "series-5",
  "series-6",
] as const;

const EXACT_COLORS = {
  light: {
    "color-bg": "#F6F4EE",
    "color-surface": "#FFFFFF",
    "color-surface-2": "#EEEBE3",
    "color-border": "#D6D2C6",
    "color-border-strong": "#7D7A70",
    "color-text": "#15171C",
    "color-text-muted": "#555B68",
    "color-primary": "#1B47C4",
    "color-primary-hover": "#13399F",
    "color-on-primary": "#FFFFFF",
    "color-danger": "#B3261E",
    "color-success": "#17692F",
    "color-warning": "#8A5300",
    "color-accent": "#F5C400",
    "color-on-accent": "#15171C",
    "focus-ring": "#1B47C4",
    "series-1": "#1B47C4",
    "series-2": "#C2410C",
    "series-3": "#0F766E",
    "series-4": "#9D2EB0",
    "series-5": "#7A5C00",
    "series-6": "#5A6272",
  },
  dark: {
    "color-bg": "#0E1116",
    "color-surface": "#161A21",
    "color-surface-2": "#1E232C",
    "color-border": "#2B313C",
    "color-border-strong": "#6E7788",
    "color-text": "#EDEFF3",
    "color-text-muted": "#A0A7B5",
    "color-primary": "#8FAAFF",
    "color-primary-hover": "#B0C2FF",
    "color-on-primary": "#0B1020",
    "color-danger": "#FF8A80",
    "color-success": "#6FD28A",
    "color-warning": "#F0B04A",
    "color-accent": "#FFD23F",
    "color-on-accent": "#15171C",
    "focus-ring": "#8FAAFF",
    "series-1": "#8FAAFF",
    "series-2": "#FB923C",
    "series-3": "#2DD4BF",
    "series-4": "#E27BF2",
    "series-5": "#F2C94C",
    "series-6": "#A9B1C0",
  },
} as const;

describe("design tokens exist", () => {
  it("defines every documented colour token in both themes", () => {
    for (const token of COLOR_TOKENS) {
      expect(light.has(token), `light --${token}`).toBe(true);
      expect(dark.has(token), `dark --${token}`).toBe(true);
    }
  });

  it("defines the documented typography, spacing, radius, elevation, motion and z tokens", () => {
    const required = [
      "font-ui",
      "font-display",
      "font-mono",
      "text-caption-size",
      "text-caption-line",
      "text-small-size",
      "text-small-line",
      "text-body-size",
      "text-body-line",
      "text-body-lg-size",
      "text-body-lg-line",
      "text-h3-size",
      "text-h3-line",
      "text-h3-weight",
      "text-h2-size",
      "text-h2-line",
      "text-h2-weight",
      "text-h1-size",
      "text-h1-line",
      "text-h1-weight",
      "text-kpi-size",
      "text-kpi-line",
      "text-kpi-weight",
      "tracking-normal",
      "tracking-tight",
      "space-0",
      "space-1",
      "space-2",
      "space-3",
      "space-4",
      "space-5",
      "space-6",
      "space-7",
      "space-8",
      "space-9",
      "space-10",
      "space-11",
      "radius-sm",
      "radius-md",
      "radius-lg",
      "radius-pill",
      "shadow-1",
      "shadow-2",
      "shadow-3",
      "dur-fast",
      "dur-base",
      "dur-slow",
      "ease-standard",
      "z-base",
      "z-sticky",
      "z-popover",
      "z-dialog",
      "z-toast",
      "z-palette",
      "sidebar-width",
      "sidebar-collapsed-width",
      "topbar-height",
      "statusbar-height",
      "content-padding",
      "hit-target",
      "focus-ring-width",
      "focus-ring-offset",
    ];
    for (const token of required) {
      expect(light.has(token), `--${token}`).toBe(true);
    }
  });
});

describe("design token values", () => {
  it("matches the D9 palette exactly", () => {
    for (const token of COLOR_TOKENS) {
      expect(light.get(token)?.toLowerCase(), `light --${token}`).toBe(
        EXACT_COLORS.light[token].toLowerCase(),
      );
      expect(dark.get(token)?.toLowerCase(), `dark --${token}`).toBe(
        EXACT_COLORS.dark[token].toLowerCase(),
      );
    }
  });

  it("matches the D9 spacing, radius, motion and z scales", () => {
    const expected: Record<string, string> = {
      "space-0": "0",
      "space-1": "2px",
      "space-2": "4px",
      "space-3": "8px",
      "space-4": "12px",
      "space-5": "16px",
      "space-6": "20px",
      "space-7": "24px",
      "space-8": "32px",
      "space-9": "40px",
      "space-10": "48px",
      "space-11": "64px",
      "radius-sm": "4px",
      "radius-md": "8px",
      "radius-lg": "12px",
      "radius-pill": "999px",
      "dur-fast": "120ms",
      "dur-base": "200ms",
      "dur-slow": "320ms",
      "ease-standard": "cubic-bezier(0.2, 0, 0, 1)",
      "z-base": "0",
      "z-sticky": "10",
      "z-popover": "30",
      "z-dialog": "40",
      "z-toast": "50",
      "z-palette": "60",
      "sidebar-width": "232px",
      "sidebar-collapsed-width": "64px",
      "topbar-height": "56px",
      "statusbar-height": "28px",
      "content-padding": "var(--space-7)",
      "hit-target": "32px",
      "focus-ring-width": "2px",
      "focus-ring-offset": "2px",
    };
    for (const [token, value] of Object.entries(expected)) {
      expect(light.get(token), `--${token}`).toBe(value);
    }
  });

  it("matches the D9 type scale", () => {
    const expected: Record<string, string> = {
      "text-caption-size": "12px",
      "text-caption-line": "16px",
      "text-small-size": "13px",
      "text-small-line": "18px",
      "text-body-size": "14px",
      "text-body-line": "20px",
      "text-body-lg-size": "16px",
      "text-body-lg-line": "24px",
      "text-h3-size": "18px",
      "text-h3-line": "26px",
      "text-h3-weight": "600",
      "text-h2-size": "22px",
      "text-h2-line": "30px",
      "text-h2-weight": "600",
      "text-h1-size": "28px",
      "text-h1-line": "36px",
      "text-h1-weight": "600",
      "text-kpi-size": "32px",
      "text-kpi-line": "36px",
      "text-kpi-weight": "650",
      "tracking-normal": "0",
      "tracking-tight": "-0.01em",
    };
    for (const [token, value] of Object.entries(expected)) {
      expect(light.get(token), `--${token}`).toBe(value);
    }
  });

  it("repeats the dark palette for the system preference block", () => {
    for (const token of COLOR_TOKENS) {
      expect(mediaDark.get(token)?.toLowerCase(), `media --${token}`).toBe(
        EXACT_COLORS.dark[token].toLowerCase(),
      );
    }
  });
});

describe("WCAG contrast gate", () => {
  for (const [name, tokens] of [
    ["light", light],
    ["dark", dark],
  ] as const) {
    it(`keeps text readable on every surface (${name})`, () => {
      for (const surface of ["color-bg", "color-surface", "color-surface-2"]) {
        expectRatio(tokens, "color-text", surface, 4.5);
        expectRatio(tokens, "color-text-muted", surface, 4.5);
      }
    });

    it(`keeps on-primary readable (${name})`, () => {
      expectRatio(tokens, "color-on-primary", "color-primary", 4.5);
    });

    it(`keeps semantic colours readable as text on surface (${name})`, () => {
      for (const token of ["color-primary", "color-danger", "color-success", "color-warning"]) {
        expectRatio(tokens, token, "color-surface", 4.5);
      }
    });

    it(`keeps strong borders visible (${name})`, () => {
      expectRatio(tokens, "color-border-strong", "color-surface", 3);
      expectRatio(tokens, "color-border-strong", "color-bg", 3);
    });

    it(`keeps every series colour visible on both surfaces (${name})`, () => {
      for (const series of [
        "series-1",
        "series-2",
        "series-3",
        "series-4",
        "series-5",
        "series-6",
      ]) {
        expectRatio(tokens, series, "color-surface", 3);
        expectRatio(tokens, series, "color-bg", 3);
      }
    });

    it(`keeps text on the accent visible (${name})`, () => {
      expectRatio(tokens, "color-on-accent", "color-accent", 4.5);
    });
  }
});
