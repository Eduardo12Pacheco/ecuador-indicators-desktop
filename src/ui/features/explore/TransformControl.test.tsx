import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { year } from "../../../core/domain/model";
import { renderWithProviders } from "../../../test/render";
import { TransformControl } from "./TransformControl";

describe("TransformControl", () => {
  it("hides the base year outside Index", () => {
    renderWithProviders(
      <TransformControl
        transform="level"
        baseYear={null}
        baseYears={[year(2000), year(2010)]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("radio", { name: "Level" })).toBeChecked();
    expect(screen.queryByLabelText("Base year")).not.toBeInTheDocument();
  });

  it("shows the base year for Index and emits the transform", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TransformControl
        transform="level"
        baseYear={null}
        baseYears={[year(2000), year(2010)]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Index" }));
    expect(onChange).toHaveBeenCalledWith("index", null);
  });

  it("selects a base year and clears it when leaving Index", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <TransformControl
        transform="index"
        baseYear={year(2000)}
        baseYears={[year(2000), year(2010)]}
        onChange={onChange}
      />,
    );
    const select = screen.getByLabelText("Base year");
    expect(select).toHaveValue("2000");
    await userEvent.selectOptions(select, "2010");
    expect(onChange).toHaveBeenCalledWith("index", year(2010));
    await userEvent.click(screen.getByRole("radio", { name: "Level" }));
    expect(onChange).toHaveBeenLastCalledWith("level", null);
  });

  it("explains when the series share no base year", () => {
    renderWithProviders(
      <TransformControl transform="index" baseYear={null} baseYears={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("Base year")).toBeDisabled();
    expect(screen.getByText("No common year")).toBeInTheDocument();
  });
});
