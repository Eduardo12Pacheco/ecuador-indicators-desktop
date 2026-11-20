import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { iso3 } from "../../../core/domain/model";
import { makeGeography } from "../../../test/factories";
import { renderWithProviders } from "../../../test/render";
import { PeersControl } from "./PeersControl";

const geographies = [
  makeGeography(),
  makeGeography({
    iso3: iso3("COL"),
    iso2: "CO",
    nameEn: "Colombia",
    nameEs: "Colombia",
    sortOrder: 2,
  }),
  makeGeography({ iso3: iso3("PER"), iso2: "PE", nameEn: "Peru", nameEs: "Perú", sortOrder: 3 }),
  makeGeography({ iso3: iso3("CHL"), iso2: "CL", nameEn: "Chile", nameEs: "Chile", sortOrder: 4 }),
  makeGeography({
    iso3: iso3("BOL"),
    iso2: "BO",
    nameEn: "Bolivia",
    nameEs: "Bolivia",
    sortOrder: 5,
  }),
  makeGeography({
    iso3: iso3("WLD"),
    iso2: "1W",
    nameEn: "World",
    nameEs: "Mundo",
    isAggregate: true,
    sortOrder: 7,
  }),
];

describe("PeersControl", () => {
  it("fixes Ecuador and adds a peer", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <PeersControl geographies={geographies} selected={[iso3("ECU")]} onChange={onChange} />,
    );
    expect(screen.getByText("Ecuador (fixed)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add Colombia" }));
    expect(onChange).toHaveBeenCalledWith([iso3("ECU"), iso3("COL")]);
    expect(screen.getByText("Colombia added")).toBeInTheDocument();
  });

  it("removes a peer chip", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <PeersControl
        geographies={geographies}
        selected={[iso3("ECU"), iso3("COL")]}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove Colombia" }));
    expect(onChange).toHaveBeenCalledWith([iso3("ECU")]);
  });

  it("enforces and announces the four-peer limit", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <PeersControl
        geographies={geographies}
        selected={[iso3("ECU"), iso3("COL"), iso3("PER"), iso3("CHL"), iso3("BOL")]}
        onChange={onChange}
      />,
    );
    const world = screen.getByRole("button", { name: "World" });
    expect(world).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(world);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("At most 4 peers plus Ecuador")).toBeInTheDocument();
  });

  it("hides the add list when every geography is selected", () => {
    renderWithProviders(
      <PeersControl
        geographies={geographies}
        selected={geographies.map((geography) => geography.iso3)}
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /^Add / })).not.toBeInTheDocument();
  });
});
