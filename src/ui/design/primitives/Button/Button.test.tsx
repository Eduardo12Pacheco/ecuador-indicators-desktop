import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

describe("Button", () => {
  it("renders a native button and forwards clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Export CSV</Button>);
    const button = screen.getByRole("button", { name: "Export CSV" });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("exposes loading as busy and disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders every variant and size", () => {
    render(
      <div>
        <Button variant="primary">primary</Button>
        <Button variant="secondary">secondary</Button>
        <Button variant="ghost">ghost</Button>
        <Button variant="danger">danger</Button>
        <Button size="sm">small</Button>
        <Button size="md">medium</Button>
      </div>,
    );
    expect(screen.getAllByRole("button")).toHaveLength(6);
  });
});
