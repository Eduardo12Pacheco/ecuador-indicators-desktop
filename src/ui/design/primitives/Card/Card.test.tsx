import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Card } from "./Card";

describe("Card", () => {
  it("renders children inside the requested landmark element", () => {
    const { container } = render(
      <Card as="section">
        <h2>KPI</h2>
      </Card>,
    );
    expect(container.querySelector("section")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "KPI" })).toBeInTheDocument();
  });

  it("defaults to a plain container", () => {
    const { container } = render(<Card>body</Card>);
    expect(container.querySelector("div")).not.toBeNull();
  });
});
