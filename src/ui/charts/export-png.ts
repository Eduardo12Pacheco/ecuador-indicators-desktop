/**
 * PNG export for charts (S7): rebuilds the option in export mode, asks the
 * renderer for a 2x data URL and converts it to bytes the native save dialog
 * can write. The conversion is separated so it is testable without a canvas.
 */

import type { EChartsCoreOption } from "echarts/core";

import type { ExploreModel } from "../../core/application/use-cases/models";
import { buildChartOption } from "./build-chart-option";
import type { ChartTheme } from "./chart-theme";
import type { ChartRenderer } from "./renderer";

/** Builds the export-mode option used for the PNG. */
export function buildExportOption(
  model: ExploreModel,
  theme: ChartTheme,
  locale: string,
): EChartsCoreOption {
  return buildChartOption(model, theme, locale, { mode: "export" });
}

/** Renders the export option and returns a PNG data URL at 2x pixel ratio. */
export function chartPngDataUrl(
  renderer: ChartRenderer,
  model: ExploreModel,
  theme: ChartTheme,
  locale: string,
): string {
  renderer.setOption(buildExportOption(model, theme, locale));
  return renderer.toDataURL({ pixelRatio: 2 });
}

const PNG_PREFIX = "data:image/png;base64,";

/**
 * Decodes a PNG data URL into bytes.
 *
 * @throws {Error} when the URL is not a base64 PNG data URL.
 */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  if (!dataUrl.startsWith(PNG_PREFIX)) {
    throw new Error("expected a base64 PNG data URL");
  }
  const binary = atob(dataUrl.slice(PNG_PREFIX.length));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
