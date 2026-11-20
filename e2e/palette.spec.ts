import { expect, test } from "@playwright/test";

import { gotoApp, openPalette, paletteInput, waitForExplore } from "./support/fixtures";

test.describe("Command palette", () => {
  test("opens with Mod+K and searches Spanish text without diacritics", async ({ page }) => {
    await gotoApp(page, { lang: "es" });
    await waitForExplore(page);

    await openPalette(page);
    await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();

    const input = paletteInput(page);
    await input.fill("inflacion");

    const result = page.getByRole("option", {
      name: /Inflación, precios al consumidor/,
    });
    await expect(result).toBeVisible();
    await result.click();

    await expect(page).toHaveURL(/\/explore\/FP\.CPI\.TOTL\.ZG/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Inflación");
  });

  test("Escape closes the palette and restores focus to the opener", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    const opener = page.getByRole("link", { name: "Settings" });
    await opener.focus();
    await expect(opener).toBeFocused();

    await openPalette(page);
    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("shows an empty-results message and announces the result count", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    await openPalette(page);
    const input = paletteInput(page);
    await input.fill("zzzz-no-match");

    await expect(page.getByText("No results for “zzzz-no-match”.")).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("status")).toContainText("0 results");
  });

  test("finds geographies by name and adds them as a peer", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    await openPalette(page);
    await paletteInput(page).fill("peru");
    await page.getByRole("option", { name: /Peru/ }).click();

    await expect(page).toHaveURL(/g=ECU%2CPER|g=ECU,PER/);
    await expect
      .poll(async () => page.locator('[data-testid="chart-canvas"]').getAttribute("aria-label"))
      .toContain("Peru");
  });
});
