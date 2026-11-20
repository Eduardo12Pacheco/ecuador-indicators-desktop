import { mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { expect, type Page, test } from "@playwright/test";

/**
 * Publication media capture (S31).
 *
 * Runs against the full bundled snapshot through the in-memory adapter, at
 * 1440x1280 with a 2x device scale factor, so every PNG is 2880x2560. The same
 * run writes the 12+ GIF frames into `.generated/frames`; the committed command
 * then stitches them with `pipeline/tools/make_gif.py`.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const screenshotsDir = resolve(root, "docs/media/screenshots");
const framesDir = resolve(root, ".generated/frames");

const DEFAULT_INDICATOR = "NY.GDP.MKTP.CD";

test.describe.configure({ mode: "serial" });

async function seed(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem("ei:theme", "light");
    localStorage.setItem("ei:lang", "en");
    localStorage.setItem(
      "ei:settings",
      JSON.stringify({
        theme: "light",
        language: "en",
        updateCheckEnabled: false,
        lastUpdateCheck: null,
        customSnapshotPath: null,
      }),
    );
  });
}

async function waitForChart(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="chart-canvas"]')).toBeVisible();
  await expect(page.locator('[data-testid="kpi-latest"]')).not.toHaveText("");
}

test("captures the screenshot set and hero frames", async ({ page }) => {
  test.setTimeout(120_000);
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(screenshotsDir, { recursive: true });
  await seed(page);

  let frame = 0;
  // Park the pointer on empty chrome (no hover styles) and wait for web fonts.
  const settle = async (): Promise<void> => {
    await page.mouse.move(720, 4);
    await page.evaluate(() => document.fonts.ready);
  };
  const frameShot = async (): Promise<void> => {
    frame += 1;
    await settle();
    await page.screenshot({
      path: resolve(framesDir, `frame-${String(frame).padStart(2, "0")}.png`),
    });
  };
  const screenshot = async (name: string): Promise<void> => {
    await settle();
    await page.screenshot({ path: resolve(screenshotsDir, `${name}.png`) });
  };

  await page.goto(`/#/explore/${DEFAULT_INDICATOR}`);
  await waitForChart(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("GDP (current US$)");
  await frameShot();

  await page.getByRole("button", { name: "Add Colombia" }).click();
  await expect
    .poll(async () => page.locator('[data-testid="chart-canvas"]').getAttribute("aria-label"))
    .toContain("Colombia");
  await frameShot();

  await page.getByRole("button", { name: "Add Peru" }).click();
  await expect
    .poll(async () => page.locator('[data-testid="chart-canvas"]').getAttribute("aria-label"))
    .toContain("Peru");
  await screenshot("explore-light");
  await frameShot();

  await page.getByRole("radio", { name: "YoY %" }).click();
  await expect(page).toHaveURL(/t=yoy/);
  await frameShot();

  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await screenshot("palette");
  await frameShot();

  await dialog.getByRole("combobox").fill("life expectancy");
  await page.getByRole("option", { name: /Life expectancy at birth/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Life expectancy");
  await expect(page).toHaveURL(/SP\.DYN\.LE00\.IN/);
  await page.getByRole("radio", { name: "Level" }).click();
  await expect(page).not.toHaveURL(/t=yoy/);
  await waitForChart(page);
  await frameShot();

  await page.getByRole("button", { name: "Toggle light and dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await screenshot("explore-dark");
  await frameShot();

  await page.keyboard.press(process.platform === "darwin" ? "Meta+s" : "Control+s");
  const saveDialog = page.getByTestId("save-view-dialog");
  await expect(saveDialog).toBeVisible();
  await page.getByTestId("save-view-name").fill("Life expectancy and peers");
  await frameShot();
  await saveDialog.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(saveDialog).toHaveCount(0);
  await expect(page.locator("[data-toast]")).toHaveCount(0, { timeout: 15_000 });

  await page.getByTestId("nav-views").click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saved views");
  await expect(page.getByTestId("view-card")).toHaveCount(1);
  await screenshot("views");
  await frameShot();

  await page.goto("/#/compare/trajectories?g=ECU&base=2000");
  await expect(page.locator('[data-testid="trajectories-chart"]')).toBeVisible();
  await expect
    .poll(async () => page.locator('[data-testid="trajectories-chart"]').getAttribute("aria-label"))
    .toContain("2000");
  await screenshot("compare-trajectories");
  await frameShot();

  await page.goto("/#/compare/ranking?i=NY.GDP.PCAP.CD&y=2020");
  await expect(page.locator('[data-testid="ranking-chart"]')).toBeVisible();
  await screenshot("compare-ranking");
  await frameShot();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  await page.getByLabel("Change language").selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajustes");
  await screenshot("settings-es");
  await frameShot();

  await page.getByLabel("Cambiar idioma").selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.goto("/#/about");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Data");
  await screenshot("data-about");
  await frameShot();

  expect(frame).toBeGreaterThanOrEqual(12);
});
