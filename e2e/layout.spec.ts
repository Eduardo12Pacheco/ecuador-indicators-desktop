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

  test("keeps the year-range thumbs on their track", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    const section = page.locator('section[aria-labelledby="range-title"]');
    const sectionBox = await section.boundingBox();
    expect(sectionBox).not.toBeNull();
    const thumbs = page.getByRole("slider");
    await expect(thumbs).toHaveCount(2);
    for (let index = 0; index < 2; index += 1) {
      const box = await thumbs.nth(index).boundingBox();
      expect(box).not.toBeNull();
      if (box !== null && sectionBox !== null) {
        expect(box.x).toBeGreaterThanOrEqual(sectionBox.x);
        expect(box.x + box.width).toBeLessThanOrEqual(sectionBox.x + sectionBox.width);
        expect(box.y).toBeGreaterThanOrEqual(sectionBox.y);
        expect(box.y + box.height).toBeLessThanOrEqual(sectionBox.y + sectionBox.height);
      }
    }
  });

  test("never lets KPI values spill out of their cards", async ({ page }) => {
    await page.setViewportSize({ width: 960, height: 640 });
    for (const hash of [
      "/explore/NY.GDP.MKTP.CD",
      "/explore/FP.CPI.TOTL.ZG?t=yoy",
      "/explore/NY.GDP.MKTP.CD?t=yoy",
    ]) {
      await gotoApp(page, { hash });
      await waitForExplore(page);
      const overflowing = await page.evaluate(() =>
        [...document.querySelectorAll('section[aria-label$="summary"] article')].flatMap((card) =>
          [...card.querySelectorAll("p")]
            .filter((text) => text.scrollWidth > card.clientWidth)
            .map((text) => `${text.textContent} (${text.scrollWidth} > ${card.clientWidth})`),
        ),
      );
      expect(overflowing, hash).toEqual([]);
    }
  });

  test("lays out the ranking controls as aligned fields", async ({ page }) => {
    await gotoApp(page, { hash: "/compare/ranking?i=NY.GDP.MKTP.CD&y=2020" });
    await expect(page.locator('[data-testid="ranking-chart"]')).toBeVisible();

    const indicator = await page.getByRole("combobox", { name: /^Indicator/ }).boundingBox();
    const year = await page.getByRole("combobox", { name: /^Year/ }).boundingBox();
    expect(indicator).not.toBeNull();
    expect(year).not.toBeNull();
    if (indicator !== null && year !== null) {
      // Two grid columns: same row, no overlap, comparable widths.
      expect(Math.abs(indicator.y - year.y)).toBeLessThan(2);
      expect(indicator.x + indicator.width).toBeLessThanOrEqual(year.x);
      expect(Math.abs(indicator.width - year.width)).toBeLessThan(2);
    }
  });

  test("does not let the scrolling picker squash its options into each other", async ({ page }) => {
    await gotoApp(page, { hash: "/compare/trajectories" });
    const options = page.getByRole("listbox", { name: "Indicators" }).getByRole("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(1);
    for (let index = 0; index < count; index += 1) {
      // Rows must keep their natural height; the listbox scrolls instead.
      const shrink = await options
        .nth(index)
        .evaluate((element) => getComputedStyle(element).flexShrink);
      expect(shrink).toBe("0");
    }
  });
});
