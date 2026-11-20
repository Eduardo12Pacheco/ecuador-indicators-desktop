import { expect, test } from "@playwright/test";

import { chartLabel, gotoApp } from "./support/fixtures";

test.describe("Compare", () => {
  test("trajectories index two indicators to a selectable base year", async ({ page }) => {
    await gotoApp(page, { hash: "/compare/trajectories" });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Compare");
    await expect(page.locator('[data-testid="trajectories-chart"]')).toBeVisible();

    const baseYear = page.getByLabel("Base year");
    await baseYear.selectOption("2000");

    await expect(page).toHaveURL(/base=2000/);
    await expect.poll(() => chartLabel(page, "trajectories-chart")).toContain("indexed to 2000");
  });

  test("trajectories cap the selection at four indicators", async ({ page }) => {
    await gotoApp(page, { hash: "/compare/trajectories" });

    const options = page.getByRole("listbox", { name: "Indicators" }).getByRole("option");
    await options.nth(0).click();
    await expect(options).toHaveCount(3);
    await options.nth(0).click();
    await expect(options).toHaveCount(2);

    await options.nth(0).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("At most 4 indicators")).toBeVisible();
    await expect(page).toHaveURL(/i=/);
  });

  test("ranking sorts descending and highlights Ecuador", async ({ page }) => {
    await gotoApp(page, { hash: "/compare/ranking?i=NY.GDP.MKTP.CD&y=2020" });

    await page.getByRole("radio", { name: "Data table" }).click();
    const table = page.locator("main table");
    await expect(table).toBeVisible();

    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(5);
    const ecuadorRow = table.locator('tbody tr[data-ecuador="true"]');
    await expect(ecuadorRow).toHaveCount(1);
    await expect(ecuadorRow).toHaveAttribute("aria-current", "true");
    await expect(ecuadorRow).toContainText("Ecuador");

    const names = await rows.locator("th").allInnerTexts();
    expect(names).toEqual(["World", "Latin America & Caribbean", "Colombia", "Peru", "Ecuador"]);
  });

  test("ranking lists geographies without data last", async ({ page }) => {
    await gotoApp(page, { hash: "/compare/ranking?i=SI.POV.NAHC&y=2020" });

    await page.getByRole("radio", { name: "Data table" }).click();
    const table = page.locator("main table");
    await expect(table).toBeVisible();

    const missing = table.locator('tbody tr[data-missing="true"]');
    await expect(missing).toHaveCount(2);
    await expect(missing.nth(0)).toContainText("No data");
    await expect(missing.nth(1)).toContainText("No data");

    const rows = table.locator("tbody tr");
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(3)).toHaveAttribute("data-missing", "true");
    await expect(rows.nth(4)).toHaveAttribute("data-missing", "true");
  });

  test("both compare tabs are reachable through the tabs control", async ({ page }) => {
    await gotoApp(page, { hash: "/compare/trajectories" });
    await expect(page.getByRole("tab", { name: "Trajectories" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await page.getByRole("tab", { name: "Ranking" }).click();
    await expect(page).toHaveURL(/\/compare\/ranking/);
    await expect(page.getByRole("tab", { name: "Ranking" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });
});
