import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { year } from "../../../core/domain/model";
import { renderWithProviders } from "../../../test/render";
import { clampRange, presetRange, RangeControl } from "./RangeControl";

const years = [year(2000), year(2005), year(2010), year(2020)];

describe("RangeControl", () => {
  it("computes presets from the latest available year", () => {
    expect(presetRange("all", year(2020))).toEqual({ from: null, to: null });
    expect(presetRange("10y", year(2020))).toEqual({ from: year(2011), to: year(2020) });
    expect(presetRange("20y", year(2020))).toEqual({ from: year(2001), to: year(2020) });
  });

  it("clamps and orders bounds", () => {
    expect(clampRange(year(2010), year(2000), year(2000), year(2020))).toEqual({
      from: year(2000),
      to: year(2010),
    });
    expect(clampRange(year(1800), year(2050), year(2000), year(2020))).toEqual({
      from: year(2000),
      to: year(2020),
    });
  });

  it("emits a preset range from the buttons", async () => {
    const onRangeChange = vi.fn();
    renderWithProviders(
      <RangeControl years={years} from={null} to={null} onRangeChange={onRangeChange} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "10y" }));
    expect(onRangeChange).toHaveBeenCalledWith(year(2011), year(2020));
    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the range ordered when a select would invert it", async () => {
    const onRangeChange = vi.fn();
    renderWithProviders(
      <RangeControl
        years={years}
        from={year(2000)}
        to={year(2005)}
        onRangeChange={onRangeChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText("From year"), "2010");
    const [from, to] = onRangeChange.mock.calls[0] ?? [];
    expect(from).toBe(2005);
    expect(to).toBe(2010);
  });

  it("shows the selected bounds and a slider", () => {
    renderWithProviders(
      <RangeControl years={years} from={year(2000)} to={year(2020)} onRangeChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("From year")).toHaveValue("2000");
    expect(screen.getByLabelText("To year")).toHaveValue("2020");
    expect(screen.getAllByRole("slider")).toHaveLength(2);
  });

  it("renders nothing without available years", () => {
    const { container } = renderWithProviders(
      <RangeControl years={[]} from={null} to={null} onRangeChange={vi.fn()} />,
    );
    expect(container.querySelector("section")).toBeNull();
  });
});
