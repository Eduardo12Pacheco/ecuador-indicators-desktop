import { defineConfig, devices } from "@playwright/test";

/**
 * Browser end-to-end configuration (T11) and publication media capture (T12).
 *
 * Default runs execute the `chromium` and `webkit` projects against the
 * production frontend build with the mini in-memory snapshot (`build:e2e`).
 * The `media` project is selected only through `npm run capture:media`; it
 * serves the full-snapshot capture build from port 18174 at 1440x1280 @2x.
 */
const mediaRun = process.argv.includes("--project=media");

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["html", { open: "never" }],
    ["json", { outputFile: ".generated/playwright.json" }],
  ],
  use: {
    baseURL: "http://localhost:18173",
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
        baseURL: "http://localhost:18174",
        viewport: { width: 1440, height: 1280 },
        deviceScaleFactor: 2,
        locale: "en-US",
        colorScheme: "light",
        // Tokens collapse every duration under reduced motion, so no capture
        // can land in the middle of a dialog or chart animation.
        reducedMotion: "reduce",
      },
    },
  ],
  webServer: mediaRun
    ? {
        command: "npm run preview -- --port 18174 --strictPort",
        url: "http://localhost:18174",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      }
    : {
        command: "npm run build:e2e && npm run preview -- --port 18173 --strictPort",
        url: "http://localhost:18173",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
