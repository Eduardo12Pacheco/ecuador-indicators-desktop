import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EChartsCoreOption } from "echarts/core";
import { describe, expect, it } from "vitest";

import { year } from "../../core/domain/model";
import { FakeChartRenderer } from "../../test/fake-chart-renderer";
import { ChartCanvas } from "./ChartCanvas";

const option: EChartsCoreOption = { series: [] };

describe("ChartCanvas", () => {
  it("initializes the injected renderer and applies the option", () => {
    const renderer = new FakeChartRenderer();
    const { unmount } = render(
      <ChartCanvas
        option={option}
        ariaLabel="GDP, Ecuador, 2000 to 2003"
        years={[year(2000), year(2001)]}
        announce={(value) => `Ecuador, ${value}: 1`}
        rendererFactory={() => renderer}
        testId="chart-canvas"
      />,
    );
    expect(screen.getByRole("group", { name: "GDP, Ecuador, 2000 to 2003" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(renderer.options).toEqual([option]);
    unmount();
    expect(renderer.disposeCalls).toBe(1);
  });

  it("scrubs with the keyboard and announces through a polite region", async () => {
    const renderer = new FakeChartRenderer();
    render(
      <ChartCanvas
        option={option}
        ariaLabel="GDP chart"
        years={[year(2000), year(2001)]}
        announce={(value) => `Ecuador, ${value}: 1`}
        rendererFactory={() => renderer}
      />,
    );
    const group = screen.getByRole("group", { name: "GDP chart" });
    await userEvent.type(group, "{ArrowRight}");
    expect(renderer.tips).toEqual([{ dataIndex: 0, seriesIndex: 0 }]);
    expect(screen.getByRole("status")).toHaveTextContent("Ecuador, 2000: 1");
    await userEvent.type(group, "{Escape}");
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("resizes without re-initializing when only the option changes", () => {
    const renderer = new FakeChartRenderer();
    const factory = () => renderer;
    const { rerender } = render(
      <ChartCanvas
        option={option}
        ariaLabel="chart"
        years={[]}
        announce={(value) => String(value)}
        rendererFactory={factory}
      />,
    );
    act(() => {
      rerender(
        <ChartCanvas
          option={{ series: [{ type: "line" }] }}
          ariaLabel="chart"
          years={[]}
          announce={(value) => String(value)}
          rendererFactory={factory}
        />,
      );
    });
    expect(renderer.options).toHaveLength(2);
    expect(renderer.disposeCalls).toBe(0);
  });
});
