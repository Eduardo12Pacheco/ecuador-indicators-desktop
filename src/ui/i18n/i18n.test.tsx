import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "./I18nProvider";
import {
  initialLang,
  LANGUAGE_STORAGE_KEY,
  localeFor,
  readStoredLang,
  storeLang,
  translate,
  translatePlural,
} from "./i18n";
import { useT } from "./useT";

function Probe() {
  const { t, tp, lang, locale, setLang } = useT();
  return (
    <div>
      <span data-testid="lang">{lang}</span>
      <span data-testid="locale">{locale}</span>
      <span data-testid="nav">{t("nav.explore")}</span>
      <span data-testid="interpolated">{t("items.count_other", { count: "3" })}</span>
      <span data-testid="plural">{tp("items.count", 2)}</span>
      <span data-testid="plural-one">{tp("items.count", 1)}</span>
      <button type="button" onClick={() => setLang("es")}>
        es
      </button>
      <button type="button" onClick={() => setLang("en")}>
        en
      </button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("translate", () => {
  it("interpolates named parameters", () => {
    expect(translate("en", "items.count_other", { count: "7" })).toBe("7 items");
    expect(translate("es", "items.count_other", { count: "7" })).toBe("7 elementos");
  });

  it("uses Intl.PluralRules for the active locale", () => {
    expect(translatePlural("en", "items.count", 1)).toBe("1 item");
    expect(translatePlural("en", "items.count", 2)).toBe("2 items");
    expect(translatePlural("es", "items.count", 1)).toBe("1 elemento");
    expect(translatePlural("es", "items.count", 2)).toBe("2 elementos");
  });
});

describe("language resolution", () => {
  it("maps languages to Intl locales", () => {
    expect(localeFor("en")).toBe("en-US");
    expect(localeFor("es")).toBe("es-EC");
  });

  it("prefers a mirrored valid language over the navigator", () => {
    expect(initialLang("en-US", "es")).toBe("es");
    expect(initialLang("es-EC", "en")).toBe("en");
  });

  it("detects Spanish navigators, including regional variants", () => {
    expect(initialLang("es-EC", null)).toBe("es");
    expect(initialLang("es", null)).toBe("es");
    expect(initialLang("pt-BR", null)).toBe("en");
  });

  it("ignores invalid stored values and unreadable storage", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "fr");
    expect(readStoredLang()).toBeNull();
    storeLang("es");
    expect(readStoredLang()).toBe("es");
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(readStoredLang(broken)).toBeNull();
    expect(() => storeLang("en", broken)).not.toThrow();
  });
});

describe("I18nProvider", () => {
  it("starts in the mirrored language and applies the document language", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "es");
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe("es");
    expect(screen.getByTestId("locale").textContent).toBe("es-EC");
    expect(screen.getByTestId("nav").textContent).toBe("Explorar");
    expect(document.documentElement.lang).toBe("es");
  });

  it("switches language without a reload and persists the mirror", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "en");
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    act(() => screen.getByRole("button", { name: "es" }).click());
    expect(screen.getByTestId("nav").textContent).toBe("Explorar");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("es");
    expect(document.documentElement.lang).toBe("es");
  });

  it("falls back to English for a non-Spanish navigator", () => {
    vi.stubGlobal("navigator", { ...navigator, language: "pt-BR" });
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByTestId("lang").textContent).toBe("en");
  });
});
