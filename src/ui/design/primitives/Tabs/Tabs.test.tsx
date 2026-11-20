import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tabs } from "./Tabs";

const items = [
  { value: "trajectories", label: "Trajectories", content: <p>trajectories panel</p> },
  { value: "ranking", label: "Ranking", content: <p>ranking panel</p> },
];

describe("Tabs", () => {
  it("switches panels on click", async () => {
    render(<Tabs items={items} defaultValue="trajectories" label="Compare modes" />);
    expect(screen.getByText("trajectories panel")).toBeVisible();
    await userEvent.click(screen.getByRole("tab", { name: "Ranking" }));
    expect(screen.getByText("ranking panel")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Ranking" })).toHaveAttribute("aria-selected", "true");
  });

  it("moves focus and selection with arrow keys", async () => {
    render(<Tabs items={items} defaultValue="trajectories" label="Compare modes" />);
    const first = screen.getByRole("tab", { name: "Trajectories" });
    const second = screen.getByRole("tab", { name: "Ranking" });
    first.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
  });
});
