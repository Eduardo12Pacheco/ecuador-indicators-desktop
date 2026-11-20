import { expect, test } from "@playwright/test";

import { expectNoA11yViolations } from "./support/a11y";
import { gotoApp, openPalette, pressModShortcut, waitForExplore } from "./support/fixtures";

type Theme = "light" | "dark";
type Lang = "en" | "es";

interface RouteCase {
  readonly name: string;
  readonly hash: string;
  readonly ready: (page: import("@playwright/test").Page, lang: Lang) => Promise<void>;
}

const ROUTES: readonly RouteCase[] = [
  {
    name: "explore",
    hash: "/explore/NY.GDP.MKTP.CD",
    ready: async (page) => {
      await waitForExplore(page);
    },
  },
  {
    name: "compare-trajectories",
    hash: "/compare/trajectories",
    ready: async (page) => {
      await expect(page.locator('[data-testid="trajectories-chart"]')).toBeVisible();
    },
  },
  {
    name: "compare-ranking",
    hash: "/compare/ranking?i=NY.GDP.MKTP.CD&y=2020",
    ready: async (page) => {
      await expect(page.locator('[data-testid="ranking-chart"]')).toBeVisible();
    },
  },
  {
    name: "views",
    hash: "/views",
    ready: async (page, lang) => {
      await expect(
        page.getByText(lang === "es" ? "Todavía no hay vistas guardadas" : "No saved views yet"),
      ).toBeVisible();
    },
  },
  {
    name: "settings",
    hash: "/settings",
    ready: async (page, lang) => {
      await expect(
        page.getByText(lang === "es" ? "Apariencia" : "Appearance", { exact: true }),
      ).toBeVisible();
    },
  },
  {
    name: "about",
    hash: "/about",
    ready: async (page) => {
      await expect(page.getByText("World Development Indicators").first()).toBeVisible();
    },
  },
  {
    name: "design",
    hash: "/design",
    ready: async (page) => {
      await expect(page.getByText("Tokens", { exact: true })).toBeVisible();
    },
  },
];

const THEMES: readonly Theme[] = ["light", "dark"];
const LANGS: readonly Lang[] = ["en", "es"];

test.describe("Accessibility", () => {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      for (const route of ROUTES) {
        test(`${route.name} route is clean in ${theme} ${lang}`, async ({ page }) => {
          await gotoApp(page, { hash: route.hash, theme, lang });
          await route.ready(page, lang);
          await expectNoA11yViolations(page);
        });
      }
    }
  }

  test("command palette is accessible", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);
    await openPalette(page);
    await expectNoA11yViolations(page);
  });

  test("save view dialog is accessible", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);
    await pressModShortcut(page, "s");
    await expect(page.getByTestId("save-view-dialog")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("shortcuts dialog is accessible", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);
    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("delete confirmation dialog is accessible", async ({ page }) => {
    const view = {
      id: "a11y-view",
      name: "A11y view",
      spec: {
        kind: "explore",
        indicator: "NY.GDP.MKTP.CD",
        geographies: ["ECU"],
        from: null,
        to: null,
        transform: "level",
        baseYear: null,
        chart: "line",
      },
      createdAt: 1_700_000_000,
      updatedAt: 1_700_000_000,
    };
    await gotoApp(page, {
      hash: "/views",
      storage: { "ei:views": JSON.stringify([view]) },
    });
    await page.getByTestId("view-card").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoA11yViolations(page);
  });
});
