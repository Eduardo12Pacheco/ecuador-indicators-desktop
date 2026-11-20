import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFakePorts } from "../test/fake-ports";
import { App } from "./App";
import { appRoutes } from "./router";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  window.location.hash = "";
  vi.unstubAllEnvs();
});

describe("App", () => {
  it("renders the shell and resolves the default Explore route", async () => {
    window.location.hash = "#/explore/NY.GDP.MKTP.CD";
    render(<App ports={createFakePorts()} />);
    expect(
      await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getAllByText("NY.GDP.MKTP.CD").length).toBeGreaterThan(0);
  });

  it("exposes the design gallery outside production builds", async () => {
    window.location.hash = "#/design";
    render(<App ports={createFakePorts()} />);
    expect(
      await screen.findByRole("heading", { name: "Design system", level: 1 }),
    ).toBeInTheDocument();
  });

  it("hides the design gallery from media-capture builds", () => {
    vi.stubEnv("DEV", false);
    vi.stubEnv("MODE", "capture");
    const children = appRoutes()[0]?.children ?? [];
    expect(children.map((route) => route.path)).not.toContain("design");
  });
});
