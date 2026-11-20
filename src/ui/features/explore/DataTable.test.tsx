import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ExploreModel } from "../../../core/application/use-cases/models";
import { iso3 } from "../../../core/domain/model";
import { makeGeography, makeIndicator, makeSeries } from "../../../test/factories";
import { renderWithProviders } from "../../../test/render";
import { DataTable } from "./DataTable";

const indicator = makeIndicator();
const ecuador = makeGeography();
const colombia = makeGeography({
  iso3: iso3("COL"),
  iso2: "CO",
  nameEn: "Colombia",
  nameEs: "Colombia",
  sortOrder: 2,
});

const model: ExploreModel = {
  indicator,
  geographies: [ecuador, colombia],
  series: [
    makeSeries(
      [
        [2000, 100],
        [2001, 110],
      ],
      { indicator, geography: ecuador },
    ),
    makeSeries([[2000, 50]], { indicator, geography: colombia }),
  ],
  transform: "level",
  baseYear: null,
  from: null,
  to: null,
  chart: "line",
};

describe("DataTable", () => {
  it("renders a captioned table with Ecuador first", () => {
    renderWithProviders(<DataTable model={model} />);
    const table = screen.getByRole("table", { name: /GDP \(current US\$\): Ecuador, Colombia/ });
    const headers = within(table).getAllByRole("columnheader");
    expect(headers.map((header) => header.textContent)).toEqual(["Year", "Ecuador", "Colombia"]);
    expect(within(table).getByRole("rowheader", { name: "2000" })).toBeInTheDocument();
  });

  it("formats values with the indicator unit and marks gaps accessibly", () => {
    renderWithProviders(<DataTable model={model} />);
    const table = screen.getByRole("table");
    expect(within(table).getByText("$100")).toBeInTheDocument();
    const missing = within(table).getAllByText("No data");
    expect(missing).toHaveLength(1);
    expect(missing[0]?.className).toMatch(/hidden/);
  });

  it("renders the empty message when there are no years", () => {
    renderWithProviders(
      <DataTable
        model={{
          ...model,
          series: [
            makeSeries([], { indicator, geography: ecuador }),
            makeSeries([], { indicator, geography: colombia }),
          ],
        }}
      />,
    );
    expect(screen.getByText("No data for the selected series and range.")).toBeInTheDocument();
  });
});
