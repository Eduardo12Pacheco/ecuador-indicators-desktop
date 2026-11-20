/**
 * ECharts adapter for the {@link ChartRenderer} port (D10).
 *
 * Only the tree-shaken subpath imports are used; importing the `echarts` root
 * would pull every chart type into the bundle. The renderer owns a
 * `ResizeObserver` so the canvas follows the shell layout instead of relying on
 * a global resize listener.
 */

import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import type { EChartsCoreOption } from "echarts/core";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

import type { ChartImageOptions, ChartRenderer } from "./renderer";

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  AriaComponent,
  TitleComponent,
  GraphicComponent,
  CanvasRenderer,
]);

/** Creates the production ECharts renderer for a mounted element. */
export function createEchartsRenderer(element: HTMLElement): ChartRenderer {
  const instance = echarts.init(element, undefined, {
    renderer: "canvas",
    devicePixelRatio:
      typeof globalThis.devicePixelRatio === "number" ? globalThis.devicePixelRatio : 1,
  });

  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver === "function") {
    observer = new ResizeObserver(() => instance.resize());
    observer.observe(element);
  }

  return {
    setOption(option: EChartsCoreOption): void {
      instance.setOption(option, { notMerge: true });
    },
    showTip(dataIndex: number, seriesIndex = 0): void {
      instance.dispatchAction({ type: "showTip", seriesIndex, dataIndex });
    },
    hideTip(): void {
      instance.dispatchAction({ type: "hideTip" });
    },
    toDataURL(options: ChartImageOptions = {}): string {
      return instance.getDataURL({
        type: "png",
        pixelRatio: options.pixelRatio ?? 2,
      });
    },
    resize(): void {
      instance.resize();
    },
    dispose(): void {
      observer?.disconnect();
      observer = null;
      instance.dispose();
    },
  };
}
