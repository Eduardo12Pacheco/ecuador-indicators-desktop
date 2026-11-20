import { expect, type Page } from "@playwright/test";

/** Interface language used by a test. */
export type E2eLanguage = "en" | "es";

/** Concrete theme used by a test. */
export type E2eTheme = "light" | "dark";

/** Options for {@link gotoApp}. */
export interface GotoAppOptions {
  /** Hash route without the leading `#`, for example `/explore/NY.GDP.MKTP.CD`. */
  readonly hash?: string;
  readonly theme?: E2eTheme;
  readonly lang?: E2eLanguage;
  /** Extra localStorage entries seeded before the first paint. */
  readonly storage?: Readonly<Record<string, string>>;
}

const DEFAULT_HASH = "/explore/NY.GDP.MKTP.CD";

/**
 * Opens the app with deterministic theme, language and storage.
 *
 * The seed runs once per browser context (guarded by `sessionStorage`) so a
 * reload keeps whatever the app itself persisted, which is what the
 * persistence specs assert.
 */
export async function gotoApp(page: Page, options: GotoAppOptions = {}): Promise<Page> {
  const { hash = DEFAULT_HASH, theme = "light", lang = "en", storage = {} } = options;

  await page.addInitScript(
    ({ theme: seededTheme, lang: seededLang, extra }) => {
      if (sessionStorage.getItem("ei:e2e-seeded") === "true") {
        return;
      }
      sessionStorage.setItem("ei:e2e-seeded", "true");
      localStorage.setItem("ei:theme", seededTheme);
      localStorage.setItem("ei:lang", seededLang);
      localStorage.setItem(
        "ei:settings",
        JSON.stringify({
          theme: seededTheme,
          language: seededLang,
          updateCheckEnabled: false,
          lastUpdateCheck: null,
          customSnapshotPath: null,
        }),
      );
      for (const [key, value] of Object.entries(extra)) {
        localStorage.setItem(key, value);
      }
    },
    { theme, lang, extra: storage },
  );

  await page.goto(`/#${hash}`);
  await expect(page.getByRole("main")).toBeVisible();
  return page;
}

/** Waits until the Explore model has rendered the chart or the data table. */
export async function waitForExplore(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="chart-canvas"], main table').first()).toBeVisible();
}

/**
 * The platform modifier the app detects from the user agent.
 *
 * Playwright WebKit reports a macOS user agent even on Linux, so tests must
 * mirror what the app sees instead of the host `process.platform`.
 */
export async function modifierKey(page: Page): Promise<"Meta" | "Control"> {
  const isMac = await page.evaluate(() => /mac/i.test(navigator.userAgent));
  return isMac ? "Meta" : "Control";
}

/** Presses a shortcut with the modifier the app expects. */
export async function pressModShortcut(page: Page, key: string): Promise<void> {
  await page.keyboard.press(`${await modifierKey(page)}+${key}`);
}

/** Opens the command palette with the platform modifier. */
export async function openPalette(page: Page): Promise<void> {
  await pressModShortcut(page, "k");
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** The cmdk search field inside the open palette. */
export function paletteInput(page: Page) {
  return page.getByRole("dialog").getByRole("combobox");
}

/** Reads the accessible summary of a rendered chart. */
export async function chartLabel(page: Page, testId = "chart-canvas"): Promise<string> {
  const value = await page.locator(`[data-testid="${testId}"]`).getAttribute("aria-label");
  return value ?? "";
}

/** Returns the visible toast texts, newest last. */
export async function toastTexts(page: Page): Promise<string[]> {
  return page.locator("[data-toast]").allInnerTexts();
}

/** Fails a test when a non-localhost request was attempted. */
export const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
