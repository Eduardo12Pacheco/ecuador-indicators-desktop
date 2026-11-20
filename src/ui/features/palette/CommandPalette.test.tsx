import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectNoA11yViolations } from "../../../test/a11y";
import { renderWithProviders } from "../../../test/render";
import { CommandPalette, type PaletteActions, type PaletteCommand } from "./CommandPalette";

const commands: PaletteCommand[] = [
  {
    id: "go-explore",
    title: "Go to Explore",
    keywords: ["explore", "indicator", "explorar", "indicador"],
  },
  {
    id: "go-settings",
    title: "Go to Settings",
    keywords: ["settings", "preferences", "ajustes"],
  },
];

function actions(overrides: Partial<PaletteActions> = {}): PaletteActions {
  return {
    openIndicator: vi.fn(),
    openGeography: vi.fn(),
    openView: vi.fn(),
    runCommand: vi.fn(),
    ...overrides,
  };
}

function Harness({
  paletteActions,
  paletteCommands = commands,
}: {
  readonly paletteActions: PaletteActions;
  readonly paletteCommands?: PaletteCommand[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open palette
      </button>
      <CommandPalette
        open={open}
        onOpenChange={setOpen}
        commands={paletteCommands}
        actions={paletteActions}
      />
    </>
  );
}

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("CommandPalette", () => {
  it("opens with Mod+K and lists the registered actions", async () => {
    const paletteActions = actions();
    renderWithProviders(<Harness paletteActions={paletteActions} />);
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Go to Explore/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Go to Settings/ })).toBeInTheDocument();
  });

  it("finds an indicator from a Spanish diacritic-insensitive query", async () => {
    localStorage.setItem("ei:lang", "es");
    const paletteActions = actions();
    renderWithProviders(<Harness paletteActions={paletteActions} />);
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    const dialog = await screen.findByRole("dialog", { name: "Paleta de comandos" });
    const input = screen.getByRole("combobox", { name: "Paleta de comandos" });
    await userEvent.type(input, "inflacion");
    await screen.findByRole("option", {
      name: /Inflación, precios al consumidor \(% anual\)/,
    });
    await userEvent.keyboard("{Enter}");
    expect(paletteActions.openIndicator).toHaveBeenCalledWith("FP.CPI.TOTL.ZG");
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("announces the result count through a polite live region", async () => {
    const paletteActions = actions();
    renderWithProviders(<Harness paletteActions={paletteActions} />);
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    await screen.findByRole("dialog", { name: "Command palette" });
    expect(screen.getByText("2 results")).toBeInTheDocument();
  });

  it("closes with Escape and restores focus to the opener", async () => {
    const paletteActions = actions();
    renderWithProviders(<Harness paletteActions={paletteActions} />);
    const trigger = screen.getByRole("button", { name: "Open palette" });
    trigger.focus();
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("shows an empty-results message", async () => {
    renderWithProviders(<Harness paletteActions={actions()} />);
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(screen.getByRole("combobox", { name: "Command palette" }), "zzzz");
    expect(await screen.findByText("No results for “zzzz”.")).toBeInTheDocument();
  });

  it("runs a command from the palette", async () => {
    const paletteActions = actions();
    renderWithProviders(<Harness paletteActions={paletteActions} />);
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.click(screen.getByRole("option", { name: /Go to Settings/ }));
    expect(paletteActions.runCommand).toHaveBeenCalledWith("go-settings");
  });

  it.each(["light", "dark"] as const)("is axe-clean in the %s theme", async (theme) => {
    document.documentElement.dataset.theme = theme;
    renderWithProviders(<Harness paletteActions={actions()} />);
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    await screen.findByRole("dialog", { name: "Command palette" });
    await expectNoA11yViolations(document.body);
  });

  it("adds a geography as an Explore peer", async () => {
    localStorage.setItem("ei:lang", "es");
    const paletteActions = actions();
    renderWithProviders(<Harness paletteActions={paletteActions} />);
    await userEvent.click(screen.getByRole("button", { name: "Open palette" }));
    await screen.findByRole("dialog", { name: "Paleta de comandos" });
    await userEvent.type(screen.getByRole("combobox", { name: "Paleta de comandos" }), "colombia");
    await userEvent.click(await screen.findByRole("option", { name: /Colombia/ }));
    expect(paletteActions.openGeography).toHaveBeenCalledWith("COL");
  });
});
