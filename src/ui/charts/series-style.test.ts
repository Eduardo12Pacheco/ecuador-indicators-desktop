import { describe, expect, it } from "vitest";

import {
  chartThemeFor,
  FALLBACK_DARK,
  FALLBACK_LIGHT,
  readChartTheme,
  themeSeriesColor,
} from "./chart-theme";
import { echartsLineType, geographySlot, styleForGeography, styleForSlot } from "./series-style";

describe("series styling", () => {
  it("maps every bundled geography to the documented stable slot", () => {
    expect(geographySlot("ECU")).toBe(1);
    expect(geographySlot("COL")).toBe(2);
    expect(geographySlot("PER")).toBe(3);
    expect(geographySlot("CHL")).toBe(4);
    expect(geographySlot("BOL")).toBe(5);
    expect(geographySlot("LCN")).toBe(6);
    expect(geographySlot("WLD")).toBe(6);
    expect(geographySlot("XYZ")).toBe(0);
  });

  it("gives every slot a distinct color token, dash and symbol", () => {
    const styles = [1, 2, 3, 4, 5, 6].map((slot) => styleForSlot(slot));
    expect(styles.map((style) => style.colorToken)).toEqual([
      "--series-1",
      "--series-2",
      "--series-3",
      "--series-4",
      "--series-5",
      "--series-6",
    ]);
    expect(new Set(styles.map((style) => style.lineType)).size).toBeGreaterThan(2);
    expect(new Set(styles.map((style) => style.symbol)).size).toBe(6);
  });

  it("keeps the aggregate dash patterns even though they share slot 6", () => {
    expect(styleForGeography("LCN").lineType).toBe("dashed");
    expect(styleForGeography("WLD").lineType).toBe("dotted");
    expect(styleForGeography("LCN").colorToken).toBe("--series-6");
    expect(styleForGeography("WLD").colorToken).toBe("--series-6");
  });

  it("falls back to a readable slot for unknown geographies", () => {
    expect(styleForGeography("XYZ", 3).slot).toBe(4);
    expect(styleForSlot(0).slot).toBe(6);
    expect(styleForSlot(7).slot).toBe(1);
  });

  it("converts domain line types to ECharts values", () => {
    expect(echartsLineType("solid")).toBe("solid");
    expect(echartsLineType("dashed")).toBe("dashed");
    expect(echartsLineType("dotted")).toBe("dotted");
    expect(echartsLineType("dash-dot")).toEqual([8, 4, 2, 4]);
  });
});

describe("chart theme", () => {
  it("returns the light fallback when no design tokens are computed", () => {
    const theme = readChartTheme(document.createElement("div"));
    expect(theme.series).toEqual(FALLBACK_LIGHT.series);
    expect(theme.background).toBe("#f6f4ee");
  });

  it("returns the dark fallback for an explicit dark root", () => {
    const root = document.createElement("div");
    root.dataset.theme = "dark";
    expect(readChartTheme(root)).toEqual(FALLBACK_DARK);
  });

  it("resolves the requested theme even before data-theme is applied", () => {
    const root = document.createElement("div");
    root.dataset.theme = "light";
    expect(chartThemeFor("dark", root)).toEqual(FALLBACK_DARK);
    expect(chartThemeFor("light", root)).toEqual(FALLBACK_LIGHT);
  });

  it("reads custom properties when the document exposes them", () => {
    const root = document.createElement("div");
    root.style.setProperty("--color-text", "#123456");
    root.style.setProperty("--series-2", "#abcdef");
    document.body.append(root);
    const theme = readChartTheme(root);
    expect(theme.text).toBe("#123456");
    expect(theme.series[1]).toBe("#abcdef");
    expect(theme.series[0]).toBe(FALLBACK_LIGHT.series[0]);
    expect(themeSeriesColor(theme, 2)).toBe("#abcdef");
    expect(themeSeriesColor(theme, 99)).toBe(FALLBACK_LIGHT.series[0]);
    root.remove();
  });
});
