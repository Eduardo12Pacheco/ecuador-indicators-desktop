import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RankingModel } from "../../../core/application/use-cases/models";
import { iso3, year } from "../../../core/domain/model";
import { makeGeography, makeIndicator } from "../../../test/factories";
import { renderWithProviders } from "../../../test/render";
import { RankingTable } from "./RankingTable";

const ecuador = makeGeography({ nameEn: "Ecuador", nameEs: "Ecuador" });
const colombia = makeGeography({ iso3: iso3("COL"), nameEn: "Colombia", sortOrder: 2 });
const peru = makeGeography({ iso3: iso3("PER"), nameEn: "Peru", nameEs: "Perú", sortOrder: 3 });
const world = makeGeography({
  iso3: iso3("WLD"),
  nameEn: "World",
  isAggregate: true,
  sortOrder: 7,
});

function model(): RankingModel {
  return {
    indicator: makeIndicator({ decimals: 0 }),
    year: year(2020),
    ranked: [
      { geography: peru, value: 300 },
      { geography: ecuador, value: 200 },
      { geography: colombia, value: 100 },
    ],
    missing: [world],
  };
}

describe("RankingTable", () => {
  it("lists ranked rows in descending order and missing values last as No data", () => {
    renderWithProviders(<RankingTable model={model()} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[1]).toHaveTextContent("Peru");
    expect(rows[2]).toHaveTextContent("Ecuador");
    expect(rows[3]).toHaveTextContent("Colombia");
    expect(rows[4]).toHaveTextContent("World");
    expect(rows[4]).toHaveTextContent("No data");
  });

  it("marks the Ecuador row and shows the difference against it", () => {
    renderWithProviders(<RankingTable model={model()} />);
    const row = document.querySelector('[data-ecuador="true"]');
    expect(row).not.toBeNull();
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveTextContent("Ecuador");
    const peruRow = screen.getByRole("row", { name: /Peru/ });
    expect(peruRow).toHaveTextContent("+100");
    expect(row).toHaveTextContent("—");
  });

  it("exposes a caption with the indicator and the year", () => {
    renderWithProviders(<RankingTable model={model()} />);
    expect(screen.getByRole("table")).toHaveAccessibleName(/GDP \(current US\$\).*2020/);
  });
});
