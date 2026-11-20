import { expect, test } from "@playwright/test";

import { gotoApp, waitForExplore } from "./support/fixtures";

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - window.innerWidth,
    body: document.body.scrollWidth - window.innerWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(0);
  expect(overflow.body).toBeLessThanOrEqual(0);
}

test.describe("Layout", () => {
  test("collapses the sidebar and avoids horizontal scroll at the minimum size", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 960, height: 640 });
    await gotoApp(page);
    await waitForExplore(page);

    await expect(page.locator("aside[data-collapsed]")).toHaveAttribute("data-collapsed", "true");
    await expectNoHorizontalScroll(page);

    for (const name of ["Export CSV", "Export PNG"]) {
      const button = page.getByRole("button", { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      if (box !== null) {
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(960);
      }
    }

    const chart = page.locator('[data-testid="chart-canvas"]');
    await expect(chart).toBeVisible();
    const chartBox = await chart.boundingBox();
    expect(chartBox).not.toBeNull();
    if (chartBox !== null) {
      expect(chartBox.width).toBeLessThanOrEqual(960);
    }
  });

  test("keeps compare controls usable at the minimum size", async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 640 });
    await gotoApp(page, { hash: "/compare/trajectories" });
    await expect(page.locator('[data-testid="trajectories-chart"]')).toBeVisible();

    await expect(page.locator("aside[data-collapsed]")).toHaveAttribute("data-collapsed", "true");
    await expectNoHorizontalScroll(page);
    await expect(page.getByLabel("Base year")).toBeVisible();
  });
});
