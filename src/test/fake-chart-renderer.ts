/**
 * Deterministic chart renderer for component and hook tests.
 * Excluded from coverage (`src/test/**`).
 */

import type { EChartsCoreOption } from "echarts/core";

import type { ChartImageOptions, ChartRenderer } from "../ui/charts/renderer";

/** Records every interaction and returns a tiny valid PNG data URL. */
export class FakeChartRenderer implements ChartRenderer {
  readonly options: EChartsCoreOption[] = [];
  readonly tips: { readonly dataIndex: number; readonly seriesIndex: number }[] = [];
  hideTipCalls = 0;
  resizeCalls = 0;
  disposeCalls = 0;
  dataUrlOperations: ChartImageOptions[] = [];

  setOption(option: EChartsCoreOption): void {
    this.options.push(option);
  }

  showTip(dataIndex: number, seriesIndex = 0): void {
    this.tips.push({ dataIndex, seriesIndex });
  }

  hideTip(): void {
    this.hideTipCalls += 1;
  }

  toDataURL(options: ChartImageOptions = {}): string {
    this.dataUrlOperations.push(options);
    return "data:image/png;base64,iVBORw0KGgo=";
  }

  resize(): void {
    this.resizeCalls += 1;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }
}
