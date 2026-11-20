/**
 * Keyboard scrubbing for charts (S11): arrows, Home/End and Escape move a
 * virtual cursor over the years that have data in the first series and ask the
 * renderer to show the corresponding tooltip. The hook is independent of
 * ECharts so the behaviour is tested with a fake renderer.
 */

import { type KeyboardEvent, useCallback, useEffect, useState } from "react";

import type { Year } from "../../core/domain/model";
import type { ChartRenderer } from "./renderer";

/**
 * Computes the next cursor position for a key.
 *
 * @returns the next index, `-1` for Escape, or `null` when the key is not a
 * scrubbing key or there are no points.
 */
export function nextScrubIndex(current: number, key: string, length: number): number | null {
  if (key === "Escape") {
    return -1;
  }
  if (length === 0) {
    return null;
  }
  switch (key) {
    case "ArrowRight":
      return current < 0 ? 0 : Math.min(current + 1, length - 1);
    case "ArrowLeft":
      return current < 0 ? length - 1 : Math.max(current - 1, 0);
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default:
      return null;
  }
}

/** Inputs for {@link useChartKeyboard}. */
export interface ChartScrubOptions {
  readonly renderer: ChartRenderer | null;
  readonly years: readonly Year[];
  readonly announce: (year: Year) => string;
}

/** Return value consumed by `ChartCanvas`. */
export interface ChartScrub {
  readonly activeIndex: number;
  readonly announcement: string;
  readonly handleKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly clear: () => void;
}

/** Implements the chart keyboard contract from S11. */
export function useChartKeyboard({ renderer, years, announce }: ChartScrubOptions): ChartScrub {
  const [activeIndex, setActiveIndex] = useState(-1);
  const [announcement, setAnnouncement] = useState("");

  const clear = useCallback(() => {
    setActiveIndex(-1);
    setAnnouncement("");
    renderer?.hideTip();
  }, [renderer]);

  useEffect(() => {
    if (activeIndex >= years.length) {
      clear();
    }
  }, [activeIndex, years.length, clear]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const next = nextScrubIndex(activeIndex, event.key, years.length);
      if (next === null) {
        return;
      }
      event.preventDefault();
      if (next === -1) {
        clear();
        return;
      }
      setActiveIndex(next);
      const target = years[next];
      if (target === undefined) {
        return;
      }
      renderer?.showTip(next);
      setAnnouncement(announce(target));
    },
    [activeIndex, announce, clear, renderer, years],
  );

  return { activeIndex, announcement, handleKeyDown, clear };
}
