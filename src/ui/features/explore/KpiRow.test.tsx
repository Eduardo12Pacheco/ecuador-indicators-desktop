import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExploreModel } from "../../../core/application/use-cases/models";
import { makeGeography, makeIndicator, makeSeries } from "../../../test/factories";
import { renderWithProviders } from "../../../test/render";
import { KpiRow } from "./KpiRow";

const indicator = makeIndicator();
const geography = makeGeography();

function model(overrides: Partial<ExploreModel> = {}): ExploreModel {
  return {
    indicator,
    geographies: [geography],
    series: [
      makeSeries(
        [
          [2000, 100],
          [2001, 110],
        ],
        { indicator, geography },
      ),
    ],
    transform: "level",
    baseYear: null,
    from: null,
    to: null,
    chart: "line",
    ...overrides,
  };
}

describe("KpiRow", () => {
  it("renders latest, change, CAGR, min and max from the visible series", () => {
    renderWithProviders(<KpiRow model={model()} />);
    expect(screen.getByText("Latest")).toBeInTheDocument();
    expect(screen.getAllByText("$110")).toHaveLength(2);
    expect(screen.getByText("+10")).toBeInTheDocument();
    expect(screen.getByText(/Improved/)).toBeInTheDocument();
    expect(screen.getAllByText("$110")).toHaveLength(2);
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("formats year-over-year values as percentages, not in the indicator's currency", () => {
    renderWithProviders(
      <KpiRow
        model={model({
          transform: "yoy",
          series: [
            makeSeries(
              [
                [2000, -30],
                [2001, 5],
              ],
              { indicator, geography },
            ),
          ],
        })}
      />,
    );
    expect(screen.getByTestId("kpi-latest")).toHaveTextContent("5.0%");
    expect(screen.getByTestId("kpi-latest")).not.toHaveTextContent("$");
    expect(screen.getByText("-30.0%")).toBeInTheDocument();
  });

  it("formats indexed values as plain numbers", () => {
    renderWithProviders(
      <KpiRow
        model={model({
          transform: "index",
          baseYear: 2000 as never,
          series: [
            makeSeries(
              [
                [2000, 100],
                [2001, 125.5],
              ],
              { indicator, geography },
            ),
          ],
        })}
      />,
    );
    expect(screen.getByTestId("kpi-latest")).toHaveTextContent("125.5");
    expect(screen.getByTestId("kpi-latest")).not.toHaveTextContent("$");
    expect(screen.getByText("100.0")).toBeInTheDocument();
  });

  it("marks a rising worse-is-better indicator as worsened", () => {
    const worse = makeIndicator({ higherIs: "worse" });
    renderWithProviders(
      <KpiRow
        model={model({
          indicator: worse,
          series: [
            makeSeries(
              [
                [2000, 100],
                [2001, 110],
              ],
              { indicator: worse, geography },
            ),
          ],
        })}
      />,
    );
    const change = screen
      .getByText(/Worsened/)
      .closest("article")
      ?.querySelector("[data-tone]");
    expect(change).toHaveAttribute("data-tone", "bad");
    expect(change).toHaveAttribute("data-direction", "up");
  });

  it("keeps neutral indicators neutral and handles missing changes", () => {
    const neutral = makeIndicator({ higherIs: "neutral" });
    renderWithProviders(
      <KpiRow
        model={model({
          indicator: neutral,
          series: [makeSeries([[2001, 5]], { indicator: neutral, geography })],
        })}
      />,
    );
    expect(screen.getByText("No previous observation")).toBeInTheDocument();
    expect(screen.getByText("No data").closest("[data-tone]")).toHaveAttribute(
      "data-tone",
      "neutral",
    );
  });

  it("renders nothing without a first series", () => {
    const { container } = renderWithProviders(<KpiRow model={model({ series: [] })} />);
    expect(container.querySelector("section")).toBeNull();
  });

  it("shows an em dash for a non-finite CAGR", () => {
    renderWithProviders(
      <KpiRow
        model={model({
          series: [
            makeSeries(
              [
                [2000, 0],
                [2001, 0],
              ],
              { indicator, geography },
            ),
          ],
        })}
      />,
    );
    expect(screen.getByText("CAGR")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
