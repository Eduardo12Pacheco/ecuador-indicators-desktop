import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end configuration (T11) and publication media capture (T12).
 *
 * Default runs execute the `chromium` and `webkit` projects against the
 * production frontend build with the mini in-memory snapshot (`build:e2e`).
 * The `media` project is selected only through `npm run capture:media`; it
 * serves the full-snapshot capture build from port 4174 at 1440x900 @2x.
 */
const mediaRun = process.argv.includes("--project=media");

export default defineConfig({
  testDir: "e2e",
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
      testIgnore: "**/media/**",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "webkit",
      testIgnore: "**/media/**",
      use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "media",
      testMatch: "**/media/**/*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://localhost:4174",
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
        locale: "en-US",
        colorScheme: "light",
      },
    },
  ],
  webServer: mediaRun
    ? {
        command: "npm run preview -- --port 4174 --strictPort",
        url: "http://localhost:4174",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : {
        command: "npm run build:e2e && npm run preview -- --port 4173 --strictPort",
        url: "http://localhost:4173",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
