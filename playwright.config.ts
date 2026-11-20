import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end configuration (T11).
 *
 * Tests run against the production frontend build with the in-memory adapter
 * loaded with the mini JSON snapshot (`npm run build:e2e`). Chromium and WebKit
 * approximate the two shipped webview engines; native E2E lives in T12.
 */
export default defineConfig({
  testDir: "e2e",
  testIgnore: "**/media/**",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [
        ["github"],
        ["html", { open: "never" }],
        ["json", { outputFile: ".generated/playwright.json" }],
      ]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: "npm run build:e2e && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
