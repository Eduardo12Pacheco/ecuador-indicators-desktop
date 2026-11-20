/**
 * `ChartRenderer` port (D8): the UI talks to an imperative chart surface
 * through this interface, so components and keyboard logic can be tested with
 * a fake renderer and never depend on ECharts.
 */

import type { EChartsCoreOption } from "echarts/core";

/** Options accepted when exporting a raster image. */
export interface ChartImageOptions {
  /** Device pixel ratio multiplier; the export flow uses 2. */
  readonly pixelRatio?: number;
}

/** Imperative chart surface implemented by `echarts-renderer.ts`. */
export interface ChartRenderer {
  /** Applies (or replaces) the complete option object. */
  setOption(option: EChartsCoreOption): void;
  /** Shows the tooltip for one data index, optionally on a given series. */
  showTip(dataIndex: number, seriesIndex?: number): void;
  /** Hides the tooltip. */
  hideTip(): void;
  /** Serializes the current chart as a PNG data URL. */
  toDataURL(options?: ChartImageOptions): string;
  /** Re-measures the container after a layout change. */
  resize(): void;
  /** Releases the underlying chart instance. */
  dispose(): void;
}

/** Creates a renderer bound to a mounted DOM element. */
export type ChartRendererFactory = (element: HTMLElement) => ChartRenderer;
