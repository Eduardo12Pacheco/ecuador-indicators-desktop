import { expect, test } from "@playwright/test";

import { gotoApp, waitForExplore } from "./support/fixtures";

test.describe("States", () => {
  test("shows an empty state with recovery actions for an empty selection", async ({ page }) => {
    await gotoApp(page, {
      hash: "/explore/SI.POV.NAHC?g=ECU,WLD&from=1960&to=1999",
    });

    await expect(page.getByText("No observations for this selection")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove peers" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back to GDP" })).toBeVisible();

    await page.getByRole("button", { name: "Back to GDP" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("GDP (current US$)");
  });

  test("error state retries and recovers when the fault is cleared", async ({ page }) => {
    await gotoApp(page, {
      storage: { "e2e:fault": "catalog" },
    });

    const alert = page.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText("simulated catalog failure");
    await expect(page.getByText("Something went wrong")).toBeVisible();

    await page.evaluate(() => localStorage.removeItem("e2e:fault"));
    await alert.getByRole("button", { name: "Retry" }).click();

    await waitForExplore(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("GDP (current US$)");
  });

  test("invalid snapshot shows the dataset problem screen and recovers on reset", async ({
    page,
  }) => {
    await gotoApp(page, {
      hash: "/settings",
      storage: { "e2e:fault": "snapshot" },
    });

    await expect(page.getByRole("heading", { name: "Dataset problem" })).toBeVisible();
    await expect(page.getByText("SNAPSHOT_INVALID: simulated snapshot failure")).toBeHidden();
    await page.getByText("Technical details", { exact: true }).click();
    await expect(page.getByText("SNAPSHOT_INVALID: simulated snapshot failure")).toBeVisible();

    await page.evaluate(() => localStorage.removeItem("e2e:fault"));
    await page.getByRole("button", { name: "Reset to bundled snapshot" }).click();

    await expect(page.getByRole("heading", { name: "Dataset problem" })).toHaveCount(0);
    await expect(page.getByText("Bundled snapshot restored.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");
  });
});
