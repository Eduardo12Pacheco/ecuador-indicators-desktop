import { expect, test } from "@playwright/test";

import { gotoApp, pressModShortcut, waitForExplore } from "./support/fixtures";

test.describe("Keyboard", () => {
  test("completes the primary flow with the keyboard only", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    // Skip link is the first focusable element.
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    // Palette: open, search, and open a result with the keyboard.
    await pressModShortcut(page, "k");
    const palette = page.getByRole("dialog");
    await expect(palette).toBeVisible();
    await palette.getByRole("combobox").fill("inflation");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/explore\/FP\.CPI\.TOTL\.ZG/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Inflation");

    // Catalog arrows move the active option and Enter selects it.
    const selectedOption = page.locator('[role="option"][aria-selected="true"]');
    await selectedOption.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("Inflation");

    // Chart scrubbing is keyboard-driven and announces through the live region.
    const chart = page.locator('[data-testid="chart-canvas"]');
    await expect(chart).toBeVisible();
    await chart.focus();
    await page.keyboard.press("ArrowRight");
    await expect(chart.getByRole("status")).toContainText("Ecuador");
    await page.keyboard.press("End");
    await expect(chart.getByRole("status")).toContainText("Ecuador");

    // Save dialog opens with Mod+S and closes with Escape.
    await pressModShortcut(page, "s");
    await expect(page.getByTestId("save-view-dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("save-view-dialog")).toHaveCount(0);

    // Shortcuts help opens with `?` and closes with Escape.
    await page.keyboard.press("Shift+Slash");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});
