import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createFakePorts } from "../test/fake-ports";
import { App } from "./App";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.location.hash = "";
});

describe("App", () => {
  it("renders the shell and resolves the default Explore route", async () => {
    window.location.hash = "#/explore/NY.GDP.MKTP.CD";
    render(<App ports={createFakePorts()} />);
    expect(
      await screen.findByRole("heading", { name: "Explore an indicator" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByText("NY.GDP.MKTP.CD")).toBeInTheDocument();
  });

  it("exposes the design gallery outside production builds", async () => {
    window.location.hash = "#/design";
    render(<App ports={createFakePorts()} />);
    expect(
      await screen.findByRole("heading", { name: "Design system", level: 1 }),
    ).toBeInTheDocument();
  });
});
