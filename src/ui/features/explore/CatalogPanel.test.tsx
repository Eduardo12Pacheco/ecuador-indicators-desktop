import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { indicatorCode } from "../../../core/domain/model";
import { makeCatalog } from "../../../test/factories";
import { renderWithProviders } from "../../../test/render";
import { CatalogPanel } from "./CatalogPanel";

function setup(selected = "NY.GDP.MKTP.CD", onSelect = vi.fn()) {
  const catalog = makeCatalog();
  renderWithProviders(<CatalogPanel catalog={catalog} selected={selected} onSelect={onSelect} />);
  return { onSelect, catalog };
}

describe("CatalogPanel", () => {
  it("groups indicators by topic and marks the selected option", () => {
    setup();
    expect(screen.getByRole("listbox", { name: "Indicators" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Economy & prices" })).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("GDP (current US$)");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[1]).toHaveAttribute("aria-selected", "false");
  });

  it("filters with the ranked, diacritic-insensitive search", async () => {
    localStorage.setItem("ei:lang", "es");
    try {
      setup();
      await userEvent.type(screen.getByLabelText("Filtrar indicadores"), "inflacion");
      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(1);
      expect(options[0]).toHaveTextContent("Inflación");
    } finally {
      localStorage.removeItem("ei:lang");
    }
  });

  it("shows a status message when nothing matches", async () => {
    setup();
    await userEvent.type(screen.getByLabelText("Filter indicators"), "zzz");
    expect(screen.getByText(/No indicators match/)).toBeInTheDocument();
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("implements roving tabindex and Enter selection", async () => {
    const { onSelect } = setup();
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("tabindex", "0");
    expect(options[1]).toHaveAttribute("tabindex", "-1");
    options[0]?.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("FP.CPI.TOTL.ZG");
  });

  it("selects an option on click", async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole("option", { name: /Inflation/ }));
    expect(onSelect).toHaveBeenCalledWith(indicatorCode("FP.CPI.TOTL.ZG"));
  });

  it("shows the Spanish topic names when the UI is in Spanish", () => {
    localStorage.setItem("ei:lang", "es");
    try {
      setup();
      expect(screen.getByRole("group", { name: "Economía y precios" })).toBeInTheDocument();
    } finally {
      localStorage.removeItem("ei:lang");
    }
  });
});
