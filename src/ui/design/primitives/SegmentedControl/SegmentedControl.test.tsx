import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const options = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

describe("SegmentedControl", () => {
  it("selects an option on click", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="Theme"
        options={options}
        value="system"
        onValueChange={onValueChange}
      />,
    );
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(onValueChange).toHaveBeenCalledWith("dark");
  });

  it("supports roving keyboard focus", async () => {
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        label="Theme"
        options={options}
        value="system"
        onValueChange={onValueChange}
      />,
    );
    const last = screen.getByRole("radio", { name: "System" });
    last.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Light" })).toHaveFocus();
  });
});
