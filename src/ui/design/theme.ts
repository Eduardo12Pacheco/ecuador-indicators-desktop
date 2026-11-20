/**
 * Theme mechanics (S8 / D11).
 *
 * UI state uses the `ThemePref` domain type. "System" is represented by an
 * absent `data-theme` attribute so the CSS media query owns the decision;
 * explicit light/dark set the attribute. The choice is mirrored to
 * `localStorage['ei:theme']` for the first-paint bootstrap, which is the only
 * reason a mirrored key exists (settings remain authoritative).
 */

import type { ThemePref } from "../../core/domain/model";

/** localStorage key mirrored for the first-paint bootstrap. */
export const THEME_STORAGE_KEY = "ei:theme";

/** The concrete theme after resolving the system preference. */
export type ResolvedTheme = "light" | "dark";

/** True for the three persisted theme preferences. */
export function isThemePref(value: unknown): value is ThemePref {
  return value === "system" || value === "light" || value === "dark";
}

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads the mirrored preference, ignoring unknown or unreadable values. */
export function readStoredTheme(storage: Storage | null = storageOrNull()): ThemePref {
  try {
    const raw = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePref(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

/** Mirrors the preference for the next launch. Best effort by design. */
export function storeTheme(pref: ThemePref, storage: Storage | null = storageOrNull()): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // A blocked localStorage must never break the Settings page.
  }
}

/** Reads the operating-system preference, defaulting to light off-DOM. */
export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Resolves a preference against a system value. */
export function resolveTheme(
  pref: ThemePref,
  system: ResolvedTheme = systemTheme(),
): ResolvedTheme {
  if (pref === "system") return system;
  return pref;
}

/** Applies the preference to the root element. */
export function applyTheme(
  pref: ThemePref,
  root: HTMLElement | null = typeof document === "undefined" ? null : document.documentElement,
): void {
  if (root === null) return;
  if (pref === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = pref;
  }
}

/** Subscribes to OS theme changes; returns the unsubscribe function. */
export function subscribeSystemTheme(listener: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
