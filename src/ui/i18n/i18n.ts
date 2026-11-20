/**
 * Typed i18n primitives (D11): no i18next, no runtime catalogue fetching.
 * `Intl` supplies plural categories and locale-aware formatting elsewhere.
 */

import type { Lang } from "../../core/domain/model";
import { en, type MessageKey, type Messages, type PluralKey } from "./en";
import { es } from "./es";

/** localStorage key mirrored for the first-paint bootstrap. */
export const LANGUAGE_STORAGE_KEY = "ei:lang";

/** Interpolation values; `tp` passes the count as a string. */
export type MessageParams = Readonly<Record<string, string | number>>;

/** Both dictionaries, keyed by the domain language. */
export const DICTIONARIES: Readonly<Record<Lang, Messages>> = { en, es };

/** True for the two supported interface languages. */
export function isLang(value: unknown): value is Lang {
  return value === "en" || value === "es";
}

/** The `Intl` locale used for the active language. */
export function localeFor(lang: Lang): "en-US" | "es-EC" {
  return lang === "es" ? "es-EC" : "en-US";
}

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads the mirrored language, ignoring unknown or unreadable values. */
export function readStoredLang(storage: Storage | null = storageOrNull()): Lang | null {
  try {
    const raw = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return isLang(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Mirrors the language for the next launch. Best effort by design. */
export function storeLang(lang: Lang, storage: Storage | null = storageOrNull()): void {
  try {
    storage?.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch {
    // A blocked localStorage must never break the language switch.
  }
}

/** Picks the initial language: mirrored choice first, then the navigator. */
export function initialLang(
  navigatorLanguage: string | undefined,
  stored: string | null = readStoredLang(),
): Lang {
  if (isLang(stored)) return stored;
  return navigatorLanguage?.toLowerCase().startsWith("es") ? "es" : "en";
}

/** Interpolates `{name}` placeholders; unknown placeholders stay literal. */
export function interpolate(template: string, params: MessageParams = {}): string {
  return template.replace(/\{([a-z]+)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined ? whole : String(value);
  });
}

/** Translates a key for a language with optional interpolation. */
export function translate(lang: Lang, key: MessageKey, params: MessageParams = {}): string {
  return interpolate(DICTIONARIES[lang][key], params);
}

/**
 * Translates a plural base key using `Intl.PluralRules` for the active locale.
 * `items.count` + 2 resolves `items.count_other`.
 */
export function translatePlural(
  lang: Lang,
  key: PluralKey,
  count: number,
  params: MessageParams = {},
): string {
  const category = new Intl.PluralRules(localeFor(lang)).select(count);
  const dictionary = DICTIONARIES[lang] as Readonly<Record<string, string>>;
  const template = dictionary[`${key}_${category}`] ?? dictionary[`${key}_other`] ?? String(count);
  return interpolate(template, { ...params, count });
}

/** The English message catalogue, exported for tests and tooling. */
export const ENGLISH_MESSAGES = en;

export type { MessageKey, PluralKey };
