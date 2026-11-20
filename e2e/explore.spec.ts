import { expect, test } from "@playwright/test";

import { chartLabel, gotoApp, waitForExplore } from "./support/fixtures";

test.describe("Explore", () => {
  test("loads the default GDP indicator with KPIs and a chart", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("GDP (current US$)");
    await expect(page.getByRole("region", { name: /GDP \(current US\$\) summary/ })).toBeVisible();
    await expect(page.getByText("Latest", { exact: true })).toBeVisible();
    await expect(page.getByText("CAGR", { exact: true })).toBeVisible();
    await expect(page.locator('[data-testid="chart-canvas"]')).toBeVisible();
    await expect(page.locator('[data-testid="chart-canvas"]')).toHaveAttribute(
      "aria-label",
      /GDP \(current US\$\).*Ecuador.*1960 to 2025/,
    );
  });

  test("switching to YoY changes the KPI values and the URL", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    const kpiRegion = page.getByRole("region", { name: /GDP \(current US\$\) summary/ });
    const before = await kpiRegion.textContent();

    await page.getByRole("radio", { name: "YoY %" }).click();

    await expect(page).toHaveURL(/\/explore\/NY\.GDP\.MKTP\.CD\?.*t=yoy/);
    await expect(page.getByRole("radio", { name: "YoY %" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect.poll(async () => kpiRegion.textContent()).not.toBe(before);
  });

  test("adding Colombia adds a second series and a second geography column", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    await page.getByRole("button", { name: "Add Colombia" }).click();

    await expect(page).toHaveURL(/g=ECU%2CCOL|g=ECU,COL/);
    await expect.poll(() => chartLabel(page)).toContain("Colombia");

    await page.getByRole("radio", { name: "Data table" }).click();
    const table = page.locator("main table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader")).toHaveCount(3);
    await expect(table.getByRole("columnheader", { name: "Ecuador" })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Colombia" })).toBeVisible();
  });

  test("range presets narrow the visible years and update the URL", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    const tenYears = page.getByRole("button", { name: "10y", exact: true });
    await tenYears.click();

    await expect(page).toHaveURL(/from=2016&to=2025/);
    await expect(tenYears).toHaveAttribute("aria-pressed", "true");

    const all = page.getByRole("button", { name: "All", exact: true });
    await all.click();

    await expect(page).not.toHaveURL(/from=|to=/);
    await expect(all).toHaveAttribute("aria-pressed", "true");
  });

  test("the chart has a data-table alternative with the same years", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    await page.getByRole("radio", { name: "Data table" }).click();
    const table = page.locator("main table");
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(67);

    await page.getByRole("radio", { name: "Chart", exact: true }).click();
    await expect(page.locator('[data-testid="chart-canvas"]')).toBeVisible();
  });
});
