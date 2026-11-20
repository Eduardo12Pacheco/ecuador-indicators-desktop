import { readFile } from "node:fs/promises";

import { expect, test } from "@playwright/test";
import Papa from "papaparse";

import { gotoApp, waitForExplore } from "./support/fixtures";

const CSV_HEADER = "indicator_code,indicator_name,iso3,geography,year,value,unit";

test.describe("Export", () => {
  test("downloads a CSV with the exact header and every visible observation", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("ecuador-NY.GDP.MKTP.CD-1960-2025.csv");

    const path = await download.path();
    expect(path).not.toBeNull();
    const content = await readFile(path ?? "", "utf8");
    const [header] = content.split("\r\n");
    expect(header).toBe(CSV_HEADER);

    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true,
    });
    expect(parsed.errors).toEqual([]);
    expect(parsed.data).toHaveLength(66);
    expect(parsed.data[0]).toMatchObject({
      indicator_code: "NY.GDP.MKTP.CD",
      iso3: "ECU",
      geography: "Ecuador",
      year: "1960",
      unit: "current US$",
    });
    expect(parsed.data.at(-1)?.year).toBe("2025");
  });

  test("downloads a PNG at export resolution", async ({ page }) => {
    await gotoApp(page);
    await waitForExplore(page);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export PNG" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("ecuador-NY.GDP.MKTP.CD-1960-2025.png");

    const path = await download.path();
    expect(path).not.toBeNull();
    const bytes = await readFile(path ?? "");
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.byteLength).toBeGreaterThan(1_000);
  });
});
