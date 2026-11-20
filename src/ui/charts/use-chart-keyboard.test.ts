import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { type Year, year } from "../../core/domain/model";
import { FakeChartRenderer } from "../../test/fake-chart-renderer";
import { nextScrubIndex, useChartKeyboard } from "./use-chart-keyboard";

const years: Year[] = [year(2000), year(2001), year(2003)];

function press(key: string): KeyboardEvent<HTMLElement> {
  return {
    key,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLElement>;
}

describe("nextScrubIndex", () => {
  it("moves within bounds and treats negative as no selection", () => {
    expect(nextScrubIndex(-1, "ArrowRight", 3)).toBe(0);
    expect(nextScrubIndex(-1, "ArrowLeft", 3)).toBe(2);
    expect(nextScrubIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextScrubIndex(1, "ArrowLeft", 3)).toBe(0);
    expect(nextScrubIndex(2, "ArrowRight", 3)).toBe(2);
    expect(nextScrubIndex(0, "ArrowLeft", 3)).toBe(0);
  });

  it("supports Home, End, Escape and ignores other keys", () => {
    expect(nextScrubIndex(1, "Home", 3)).toBe(0);
    expect(nextScrubIndex(1, "End", 3)).toBe(2);
    expect(nextScrubIndex(1, "Escape", 3)).toBe(-1);
    expect(nextScrubIndex(1, "Enter", 3)).toBeNull();
    expect(nextScrubIndex(1, "ArrowRight", 0)).toBeNull();
    expect(nextScrubIndex(1, "Escape", 0)).toBe(-1);
  });
});

describe("useChartKeyboard", () => {
  it("shows the tooltip and announces the focused year", () => {
    const renderer = new FakeChartRenderer();
    const { result } = renderHook(() =>
      useChartKeyboard({
        renderer,
        years,
        announce: (value) => `Ecuador, ${value}: value`,
      }),
    );
    const event = press("ArrowRight");
    act(() => result.current.handleKeyDown(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(renderer.tips).toEqual([{ dataIndex: 0, seriesIndex: 0 }]);
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.announcement).toBe("Ecuador, 2000: value");

    act(() => result.current.handleKeyDown(press("End")));
    expect(renderer.tips[1]).toEqual({ dataIndex: 2, seriesIndex: 0 });
    expect(result.current.announcement).toBe("Ecuador, 2003: value");
  });

  it("clears the tooltip and announcement on Escape", () => {
    const renderer = new FakeChartRenderer();
    const { result } = renderHook(() =>
      useChartKeyboard({ renderer, years, announce: (value) => String(value) }),
    );
    act(() => result.current.handleKeyDown(press("Home")));
    expect(result.current.announcement).toBe("2000");
    act(() => result.current.handleKeyDown(press("Escape")));
    expect(renderer.hideTipCalls).toBe(1);
    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.announcement).toBe("");
  });

  it("ignores keys while there is no data", () => {
    const renderer = new FakeChartRenderer();
    const { result } = renderHook(() =>
      useChartKeyboard({ renderer, years: [], announce: (value) => String(value) }),
    );
    const event = press("ArrowRight");
    act(() => result.current.handleKeyDown(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(renderer.tips).toEqual([]);
  });

  it("resets the cursor when the visible series shrinks", () => {
    const renderer = new FakeChartRenderer();
    const { result, rerender } = renderHook(
      ({ points }: { readonly points: Year[] }) =>
        useChartKeyboard({ renderer, years: points, announce: (value) => String(value) }),
      { initialProps: { points: years } },
    );
    act(() => result.current.handleKeyDown(press("End")));
    expect(result.current.activeIndex).toBe(2);
    rerender({ points: [year(2000)] });
    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.announcement).toBe("");
  });
});
