import { resolve } from "node:path";

import { artifactsDir, ensureArtifacts, waitForApp } from "./support";

describe("native launch", () => {
  it("opens the real window with the full catalog and a GDP KPI", async () => {
    await waitForApp();

    expect(await browser.getTitle()).toBe("Ecuador Indicators");

    const options = await $$('[data-testid="catalog-option"]');
    expect(options).toHaveLength(38);

    const latest = await $('[data-testid="kpi-latest"]').getText();
    expect(latest.trim().length).toBeGreaterThan(0);

    ensureArtifacts();
    await browser.saveScreenshot(resolve(artifactsDir, "native-window.png"));
  });
});
