import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "../Button/Button";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders a title, description and recovery action", () => {
    render(
      <EmptyState
        title="No saved views"
        description="Save one from Explore."
        action={<Button>Go to Explore</Button>}
      />,
    );
    expect(screen.getByRole("heading", { name: "No saved views" })).toBeInTheDocument();
    expect(screen.getByText("Save one from Explore.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Explore" })).toBeInTheDocument();
  });
});
