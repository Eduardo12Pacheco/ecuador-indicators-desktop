import { documentAttribute, navigateTo, pressMod, waitForApp } from "./support";

const VIEW_NAME = "Native GDP view";

async function waitForHeading(text: string): Promise<void> {
  await browser.waitUntil(
    async () => (await $("h1").getText()).trim() === text,
    { timeout: 20_000, timeoutMsg: `heading ${text} did not render` },
  );
}

describe("native persistence", () => {
  it("keeps saved views and the dark theme across a restart", async () => {
    await waitForApp();

    await pressMod("s");
    const dialog = await $('[data-testid="save-view-dialog"]');
    await dialog.waitForDisplayed({ timeout: 10_000 });
    await $('[data-testid="save-view-name"]').setValue(VIEW_NAME);
    await dialog.$('button[type="submit"]').click();
    await dialog.waitForDisplayed({ timeout: 10_000, reverse: true });

    await navigateTo("/settings");
    await waitForHeading("Settings");
    const segmented = await $('[data-testid="theme-segmented"]');
    await segmented.$("button=Dark").click();
    await browser.waitUntil(async () => (await documentAttribute("data-theme")) === "dark", {
      timeout: 10_000,
      timeoutMsg: "the dark theme was not applied",
    });

    await browser.reloadSession();
    await waitForApp();

    expect(await documentAttribute("data-theme")).toBe("dark");

    await navigateTo("/views");
    await waitForHeading("Saved views");
    const card = await $('[data-testid="view-card"]');
    await card.waitForDisplayed({ timeout: 20_000 });
    expect(await card.getText()).toContain(VIEW_NAME);
    expect(await $$('[data-testid="view-card"]')).toHaveLength(1);
  });
});
