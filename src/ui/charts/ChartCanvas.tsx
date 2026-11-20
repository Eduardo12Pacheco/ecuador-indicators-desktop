import type { EChartsCoreOption } from "echarts/core";
import { useEffect, useRef, useState } from "react";

import type { Year } from "../../core/domain/model";
import { LiveRegion } from "../design/primitives/LiveRegion/LiveRegion";
import styles from "./ChartCanvas.module.css";
import { createEchartsRenderer } from "./echarts-renderer";
import type { ChartRenderer, ChartRendererFactory } from "./renderer";
import { useChartKeyboard } from "./use-chart-keyboard";

export interface ChartCanvasProps {
  readonly option: EChartsCoreOption;
  /** Computed summary, for example "{indicator}, {geographies}, from to to". */
  readonly ariaLabel: string;
  /** Years with data in the first series, in ascending order. */
  readonly years: readonly Year[];
  /** Builds the polite announcement for one focused year. */
  readonly announce: (year: Year) => string;
  /** Injectable renderer factory; defaults to the ECharts adapter. */
  readonly rendererFactory?: ChartRendererFactory;
  readonly testId?: string;
  /** Notifies the page when the renderer is created or disposed (PNG export). */
  readonly onRendererChange?: (renderer: ChartRenderer | null) => void;
}

/**
 * Accessible chart surface: owns the renderer, exposes `role="group"` with a
 * summary, makes the chart focusable and delegates scrubbing to the keyboard
 * hook. The canvas itself is decorative to assistive technology because the
 * live region and the Data table carry the same information.
 */
export function ChartCanvas({
  option,
  ariaLabel,
  years,
  announce,
  rendererFactory,
  testId,
  onRendererChange,
}: ChartCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderer, setRenderer] = useState<ChartRenderer | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (element === null) {
      return;
    }
    const created = (rendererFactory ?? createEchartsRenderer)(element);
    setRenderer(created);
    onRendererChange?.(created);
    return () => {
      created.dispose();
      setRenderer(null);
      onRendererChange?.(null);
    };
  }, [rendererFactory, onRendererChange]);

  useEffect(() => {
    renderer?.setOption(option);
  }, [renderer, option]);

  const { announcement, handleKeyDown } = useChartKeyboard({ renderer, years, announce });

  return (
    // biome-ignore lint/a11y/useSemanticElements: a chart is an ARIA group, not a form fieldset.
    <div
      className={styles.root}
      role="group"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      data-testid={testId}
    >
      <div ref={containerRef} className={styles.canvas} aria-hidden="true" />
      <LiveRegion>{announcement}</LiveRegion>
    </div>
  );
}
