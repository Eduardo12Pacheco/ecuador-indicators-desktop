import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render";
import { ShortcutsDialog } from "./ShortcutsDialog";

describe("ShortcutsDialog", () => {
  it("lists every shortcut with its formatted keys", () => {
    renderWithProviders(
      <ShortcutsDialog
        open
        onOpenChange={() => undefined}
        entries={[
          { id: "open-palette", title: "Open command palette", keys: ["Ctrl", "K"] },
          { id: "go-explore", title: "Go to Explore", keys: ["g", "e"] },
        ]}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(dialog).toHaveAccessibleDescription("Every primary action has a keyboard path.");
    expect(screen.getByRole("rowheader", { name: "Open command palette" })).toBeInTheDocument();
    expect(screen.getByText("Ctrl")).toBeInTheDocument();
    expect(screen.getByText("K")).toBeInTheDocument();
    expect(screen.getByText("g")).toBeInTheDocument();
    expect(screen.getByText("e")).toBeInTheDocument();
  });

  it("closes through the close button", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(<ShortcutsDialog open onOpenChange={onOpenChange} entries={[]} />);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
