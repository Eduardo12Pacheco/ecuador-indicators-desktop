import { expect, test } from "@playwright/test";

import { gotoApp, pressModShortcut, waitForExplore } from "./support/fixtures";

const VIEW_NAME = "GDP with Colombia";

async function saveCurrentView(page: import("@playwright/test").Page, name: string) {
  await pressModShortcut(page, "s");
  const dialog = page.getByTestId("save-view-dialog");
  await expect(dialog).toBeVisible();
  const input = page.getByTestId("save-view-name");
  await expect(input).not.toHaveValue("");
  await input.fill(name);
  await dialog.getByRole("button", { name: "Save view", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`Saved “${name}”`, { exact: false }).first()).toBeVisible();
}

async function prepareSavedView(page: import("@playwright/test").Page) {
  await gotoApp(page);
  await waitForExplore(page);
  await page.getByRole("button", { name: "Add Colombia" }).click();
  await page.getByRole("radio", { name: "YoY %" }).click();
  await expect(page).toHaveURL(/g=ECU%2CCOL|g=ECU,COL/);
  await saveCurrentView(page, VIEW_NAME);
}

test.describe("Saved views", () => {
  test("saves a view, persists it across reloads and reopens the exact state", async ({ page }) => {
    await prepareSavedView(page);

    await page.getByRole("link", { name: "Saved views" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saved views");
    await expect(page.getByTestId("view-card")).toHaveCount(1);
    await expect(page.getByTestId("view-card")).toContainText(VIEW_NAME);

    await page.reload();
    await expect(page.getByTestId("view-card")).toHaveCount(1);
    await expect(page.getByTestId("view-card")).toContainText(VIEW_NAME);

    await page.getByTestId("view-card").getByRole("button", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/explore\/NY\.GDP\.MKTP\.CD\?/);
    await expect(page).toHaveURL(/g=ECU%2CCOL|g=ECU,COL/);
    await expect(page).toHaveURL(/t=yoy/);
    await expect(page.getByRole("radio", { name: "YoY %" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect
      .poll(async () => page.locator('[data-testid="chart-canvas"]').getAttribute("aria-label"))
      .toContain("Colombia");
  });

  test("renames a saved view", async ({ page }) => {
    await prepareSavedView(page);
    await page.getByRole("link", { name: "Saved views" }).click();

    await page.getByTestId("view-card").getByRole("button", { name: "Rename" }).click();
    const dialog = page.getByTestId("save-view-dialog");
    await expect(dialog).toBeVisible();
    await page.getByTestId("save-view-name").fill("GDP renamed");
    await dialog.getByRole("button", { name: /^Update/ }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId("view-card")).toContainText("GDP renamed");
    await expect(page.getByTestId("view-card")).not.toContainText(VIEW_NAME);
  });

  test("deletes a saved view after confirmation", async ({ page }) => {
    await prepareSavedView(page);
    await page.getByRole("link", { name: "Saved views" }).click();

    await page.getByTestId("view-card").getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog", { name: `Delete “${VIEW_NAME}”?` });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Delete view" }).click();

    await expect(page.getByTestId("view-card")).toHaveCount(0);
    await expect(page.getByText("No saved views yet")).toBeVisible();
  });

  test("shows a first-run empty state with a path back to Explore", async ({ page }) => {
    await gotoApp(page, { hash: "/views" });

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Saved views");
    await expect(page.getByText("No saved views yet")).toBeVisible();
    await page.getByRole("button", { name: "Go to Explore" }).click();
    await expect(page).toHaveURL(/\/explore\/NY\.GDP\.MKTP\.CD/);
  });
});
