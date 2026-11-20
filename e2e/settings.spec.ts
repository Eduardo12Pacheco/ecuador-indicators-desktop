import { expect, test } from "@playwright/test";

import { gotoApp } from "./support/fixtures";

test.describe("Settings", () => {
  test("theme and language apply immediately and persist across reloads", async ({ page }) => {
    await gotoApp(page, { hash: "/settings" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");

    const theme = page.getByRole("radiogroup", { name: "Theme" });
    await theme.getByRole("radio", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const language = page.getByRole("radiogroup", { name: "Language" });
    await language.getByRole("radio", { name: "Español" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("link", { name: "Explorar" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Ajustes");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
    await expect(page.getByRole("link", { name: "Explorar" })).toBeVisible();
  });

  test("theme and language chosen in the top bar persist and show up in Settings", async ({
    page,
  }) => {
    await gotoApp(page, { hash: "/explore/NY.GDP.MKTP.CD" });

    await page.getByRole("button", { name: "Toggle light and dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByLabel("Change language").selectOption("es");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    await page.getByRole("link", { name: "Ajustes" }).click();
    await expect(
      page.getByRole("radiogroup", { name: "Tema" }).getByRole("radio", { name: "Oscuro" }),
    ).toBeChecked();
    await expect(
      page.getByRole("radiogroup", { name: "Idioma" }).getByRole("radio", { name: "Español" }),
    ).toBeChecked();
  });

  test("update check is off by default and makes no request on launch when disabled", async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        externalRequests.push(url.toString());
      }
    });

    await gotoApp(page, { hash: "/settings" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Settings");

    const toggle = page.getByRole("switch", { name: "Check for updates at launch" });
    await expect(toggle).not.toBeChecked();

    await page.getByRole("button", { name: "Check now" }).click();
    await expect(
      page.getByText("Update checks are off. Turn them on to compare versions."),
    ).toBeVisible();

    expect(externalRequests.filter((url) => url.includes("github.com"))).toEqual([]);
  });

  test("shows dataset counts and read-only storage locations", async ({ page }) => {
    await gotoApp(page, { hash: "/settings" });

    await expect(page.getByText("6 indicators · 5 geographies · 1,524 observations")).toBeVisible();
    await expect(page.getByText("World Development Indicators · The World Bank")).toBeVisible();
    await expect(page.getByText("Data directory")).toBeVisible();
    await expect(page.getByText("Log directory")).toBeVisible();
  });

  test("returning the theme to System removes the explicit attribute", async ({ page }) => {
    await gotoApp(page, { hash: "/settings", theme: "dark" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    const theme = page.getByRole("radiogroup", { name: "Theme" });
    await theme.getByRole("radio", { name: "System" }).click();

    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  });
});
