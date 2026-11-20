import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { gotoApp, pressModShortcut, waitForExplore } from "./support/fixtures";
import { guardNetwork } from "./support/network-guard";

test.describe("Offline", () => {
  test("runs the full Explore, Compare, Save and Export flow without external requests", async ({
    page,
  }) => {
    const guard = await guardNetwork(page);

    await gotoApp(page);
    await waitForExplore(page);

    await page.getByRole("button", { name: "Add Colombia" }).click();
    await page.getByRole("radio", { name: "YoY %" }).click();
    await expect
      .poll(async () => page.locator('[data-testid="chart-canvas"]').getAttribute("aria-label"))
      .toContain("Colombia");

    const csvDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const csv = await csvDownload;
    const csvPath = await csv.path();
    expect(csvPath).not.toBeNull();
    const csvContent = await readFile(csvPath ?? "", "utf8");
    expect(csvContent).toContain("indicator_code,indicator_name,iso3,geography,year,value,unit");
    expect(csvContent).toContain("ECU,Ecuador");
    expect(csvContent).toContain("COL,Colombia");

    await page.getByRole("link", { name: "Compare" }).click();
    await expect(page).toHaveURL(/\/compare\/trajectories/);
    await page.getByRole("tab", { name: "Ranking" }).click();
    await page.getByRole("radio", { name: "Data table" }).click();
    await expect(page.locator("main table")).toBeVisible();

    await page.getByRole("link", { name: "Explore" }).click();
    await waitForExplore(page);
    await pressModShortcut(page, "s");
    await page.getByTestId("save-view-name").fill("Offline view");
    await page.getByTestId("save-view-dialog").getByRole("button", { name: "Save view" }).click();
    await expect(page.getByTestId("save-view-dialog")).toHaveCount(0);

    const pngDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG" }).click();
    const png = await pngDownload;
    expect(await png.path()).not.toBeNull();

    expect(guard.blockedRequests).toEqual([]);
  });
});
