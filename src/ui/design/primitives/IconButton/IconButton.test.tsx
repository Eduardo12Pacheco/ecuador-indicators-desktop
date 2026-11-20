import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IconButton } from "./IconButton";

describe("IconButton", () => {
  it("requires and exposes an accessible label", async () => {
    const onClick = vi.fn();
    render(
      <IconButton label="Open settings" onClick={onClick}>
        <svg aria-hidden="true" />
      </IconButton>,
    );
    const button = screen.getByRole("button", { name: "Open settings" });
    expect(button).toHaveAttribute("title", "Open settings");
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  it("supports the danger variant and small size", () => {
    render(
      <IconButton label="Delete" variant="danger" size="sm">
        x
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });
});
