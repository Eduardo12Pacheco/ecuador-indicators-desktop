import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import type { AppPorts } from "../../../core/application/ports";
import {
  type Catalog,
  indicatorCode,
  iso3,
  type Observation,
  year,
} from "../../../core/domain/model";
import { ok, type Result } from "../../../core/domain/result";
import { expectNoA11yViolations } from "../../../test/a11y";
import {
  makeCatalog,
  makeDatasetInfo,
  makeGeography,
  makeIndicator,
} from "../../../test/factories";
import { FakeChartRenderer } from "../../../test/fake-chart-renderer";
import { renderWithProviders } from "../../../test/render";
import { ComparePage } from "./ComparePage";

const gdp = makeIndicator();
const inflation = makeIndicator({
  code: indicatorCode("FP.CPI.TOTL.ZG"),
  nameEn: "Inflation, consumer prices (annual %)",
  nameEs: "Inflación, precios al consumidor (% anual)",
  valueKind: "percent",
  decimals: 1,
  higherIs: "worse",
  sortOrder: 5,
});
const population = makeIndicator({
  code: indicatorCode("SP.POP.TOTL"),
  nameEn: "Population, total",
  nameEs: "Población total",
  valueKind: "number",
  decimals: 0,
  sortOrder: 19,
});
const life = makeIndicator({
  code: indicatorCode("SP.DYN.LE00.IN"),
  nameEn: "Life expectancy at birth (years)",
  nameEs: "Esperanza de vida al nacer (años)",
  valueKind: "years",
  decimals: 1,
  sortOrder: 22,
});
const internet = makeIndicator({
  code: indicatorCode("IT.NET.USER.ZS"),
  nameEn: "Individuals using the Internet (% of population)",
  nameEs: "Personas que usan Internet (% de la población)",
  sortOrder: 37,
});

const ecuador = makeGeography();
const colombia = makeGeography({
  iso3: iso3("COL"),
  iso2: "CO",
  nameEn: "Colombia",
  nameEs: "Colombia",
  sortOrder: 2,
});
const peru = makeGeography({
  iso3: iso3("PER"),
  iso2: "PE",
  nameEn: "Peru",
  nameEs: "Perú",
  sortOrder: 3,
});
const chile = makeGeography({
  iso3: iso3("CHL"),
  iso2: "CL",
  nameEn: "Chile",
  nameEs: "Chile",
  sortOrder: 4,
});
const bolivia = makeGeography({
  iso3: iso3("BOL"),
  iso2: "BO",
  nameEn: "Bolivia",
  nameEs: "Bolivia",
  sortOrder: 5,
});
const latinAmerica = makeGeography({
  iso3: iso3("LCN"),
  iso2: "LC",
  nameEn: "Latin America & Caribbean",
  nameEs: "América Latina y el Caribe",
  isAggregate: true,
  sortOrder: 6,
});
const world = makeGeography({
  iso3: iso3("WLD"),
  iso2: "1W",
  nameEn: "World",
  nameEs: "Mundo",
  isAggregate: true,
  sortOrder: 7,
});

const geographies = [ecuador, colombia, peru, chile, bolivia, latinAmerica, world];

function observations(): Observation[] {
  const rows: [string, string, number, number][] = [
    ["NY.GDP.MKTP.CD", "ECU", 2000, 100],
    ["NY.GDP.MKTP.CD", "ECU", 2001, 110],
    ["NY.GDP.MKTP.CD", "ECU", 2002, 120],
    ["NY.GDP.MKTP.CD", "ECU", 2003, 130],
    ["NY.GDP.MKTP.CD", "ECU", 2004, 140],
    ["NY.GDP.MKTP.CD", "COL", 2000, 50],
    ["NY.GDP.MKTP.CD", "COL", 2001, 55],
    ["NY.GDP.MKTP.CD", "COL", 2002, 60],
    ["NY.GDP.MKTP.CD", "COL", 2003, 65],
    ["NY.GDP.MKTP.CD", "COL", 2004, 100],
    ["NY.GDP.MKTP.CD", "PER", 2004, 300],
    ["NY.GDP.MKTP.CD", "CHL", 2004, 50],
    ["NY.GDP.MKTP.CD", "BOL", 2004, 25],
    ["NY.GDP.MKTP.CD", "LCN", 2004, 10],
    ["NY.GDP.MKTP.CD", "WLD", 2003, 1000],
    ["FP.CPI.TOTL.ZG", "ECU", 2000, 10],
    ["FP.CPI.TOTL.ZG", "ECU", 2001, 11],
    ["FP.CPI.TOTL.ZG", "ECU", 2002, 12],
    ["FP.CPI.TOTL.ZG", "COL", 2000, 5],
    ["SP.POP.TOTL", "ECU", 2010, 1000],
    ["SP.DYN.LE00.IN", "ECU", 2000, 70],
    ["SP.DYN.LE00.IN", "ECU", 2001, 71],
    ["SP.DYN.LE00.IN", "ECU", 2002, 72],
    ["SP.DYN.LE00.IN", "ECU", 2003, 73],
    ["SP.DYN.LE00.IN", "ECU", 2004, 74],
    ["IT.NET.USER.ZS", "ECU", 2004, 20],
  ];
  return rows.map(([code, geography, valueYear, value]) => ({
    indicatorCode: indicatorCode(code),
    iso3: iso3(geography),
    year: year(valueYear),
    value,
  }));
}

function ports(overrides: Partial<AppPorts> = {}): AppPorts {
  const catalog: Catalog = {
    ...makeCatalog(),
    geographies,
    indicators: [gdp, inflation, population, life, internet],
  };
  return {
    dataset: {
      getInfo: async () => ok(makeDatasetInfo()),
      getCatalog: async (): Promise<Result<Catalog>> => ok(catalog),
      getObservations: async (codes, iso3s) => {
        const codeSet = new Set(codes);
        const geographySet = new Set(iso3s);
        return ok(
          observations().filter(
            (row) => codeSet.has(row.indicatorCode) && geographySet.has(row.iso3),
          ),
        );
      },
      openSnapshot: async () => ok(makeDatasetInfo()),
      resetSnapshot: async () => ok(makeDatasetInfo()),
    },
    views: {
      list: async () => ok([]),
      create: async () => ok({} as never),
      update: async () => ok({} as never),
      remove: async () => ok(undefined),
    },
    settings: {
      get: async () => ok({} as never),
      set: async () => ok(undefined),
    },
    export: { save: async () => ok("/tmp/export.csv") },
    updates: { check: async () => ok({ kind: "disabled", current: "0.1.0" }) },
    appInfo: {
      get: async () => ok({ version: "0.1.0", platform: "linux", dataDir: "", logDir: "" }),
    },
    ...overrides,
  };
}

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

function LocationEcho() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderCompare(path: string, appPorts: AppPorts = ports()) {
  const renderer = new FakeChartRenderer();
  const view = renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/compare/trajectories"
          element={<ComparePage chartRendererFactory={() => renderer} />}
        />
        <Route
          path="/compare/ranking"
          element={<ComparePage chartRendererFactory={() => renderer} />}
        />
      </Routes>
      <LocationEcho />
    </MemoryRouter>,
    { ports: appPorts },
  );
  return { renderer, ...view };
}

function lastOption(renderer: FakeChartRenderer): {
  readonly series: readonly {
    readonly name?: string;
    readonly data: readonly (number | null)[];
  }[];
} {
  return renderer.options[renderer.options.length - 1] as unknown as {
    readonly series: readonly {
      readonly name?: string;
      readonly data: readonly (number | null)[];
    }[];
  };
}

describe("ComparePage trajectories", () => {
  it("loads two indicators indexed to their common base year", async () => {
    const { renderer } = renderCompare("/compare/trajectories");
    expect(await screen.findByRole("group", { name: /indexed to 2000/i })).toBeInTheDocument();
    const option = lastOption(renderer);
    expect(option.series).toHaveLength(3);
    expect(option.series[0]?.name).toBe("GDP (current US$)");
    const head = option.series[0]?.data.slice(0, 3) ?? [];
    expect(head[0]).toBeCloseTo(100, 6);
    expect(head[1]).toBeCloseTo(110, 6);
    expect(head[2]).toBeCloseTo(120, 6);
    expect(screen.getByRole("combobox", { name: "Base year" })).toHaveValue("2000");
  });

  it("writes geography and base year changes to the URL", async () => {
    const { renderer } = renderCompare("/compare/trajectories");
    await screen.findByRole("group", { name: /indexed to/i });
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Base year" }), "2001");
    expect(screen.getByTestId("location")).toHaveTextContent("base=2001");
    expect(lastOption(renderer).series[0]?.data[0]).toBeCloseTo(90.909, 2);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Geography" }), "COL");
    expect(screen.getByTestId("location")).toHaveTextContent("g=COL");
    expect(await screen.findByRole("group", { name: /Colombia/ })).toBeInTheDocument();
  });

  it("lays out a data table alternative for trajectories", async () => {
    renderCompare("/compare/trajectories");
    await screen.findByRole("group", { name: /indexed to/i });
    await userEvent.click(screen.getByRole("radio", { name: "Data table" }));
    const table = screen.getByRole("table");
    expect(table).toHaveAccessibleName(/GDP \(current US\$\)/);
    expect(
      screen.getByRole("columnheader", { name: "Inflation, consumer prices (annual %)" }),
    ).toBeInTheDocument();
  });

  it("enforces the maximum of four indicators and announces it", async () => {
    renderCompare("/compare/trajectories");
    await screen.findByRole("group", { name: /indexed to/i });
    await userEvent.click(screen.getByRole("option", { name: "Add Population, total" }));
    await userEvent.click(
      screen.getByRole("option", { name: "Add Life expectancy at birth (years)" }),
    );
    expect(screen.getByTestId("location").textContent).toContain(
      "i=NY.GDP.MKTP.CD,FP.CPI.TOTL.ZG,SP.POP.TOTL,SP.DYN.LE00.IN",
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Add Individuals using the Internet (% of population)" }),
    );
    expect(screen.getByText("At most 4 indicators")).toBeInTheDocument();
  });

  it("explains when the selected indicators share no base year", async () => {
    renderCompare("/compare/trajectories?i=NY.GDP.MKTP.CD,SP.POP.TOTL");
    expect(await screen.findByRole("heading", { name: "No common base year" })).toBeInTheDocument();
    expect(screen.getByText(/share no year for Ecuador/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use default indicators" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/compare/trajectories");
  });

  it.each(["light", "dark"] as const)(
    "passes axe on the trajectories tab in the %s theme",
    async (theme) => {
      document.documentElement.dataset.theme = theme;
      renderCompare("/compare/trajectories");
      await screen.findByRole("group", { name: /indexed to/i });
      await expectNoA11yViolations(document.body);
    },
  );
});

describe("ComparePage ranking", () => {
  it("ranks every geography, highlights Ecuador and lists missing values last", async () => {
    renderCompare("/compare/ranking");
    await screen.findByRole("combobox", { name: "Year" });
    await userEvent.click(screen.getByRole("radio", { name: "Data table" }));
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Peru");
    expect(rows[1]).toHaveTextContent("300");
    expect(rows[2]).toHaveTextContent("Ecuador");
    expect(rows[2]).toHaveTextContent("140");
    const ecuadorRow = document.querySelector('[data-ecuador="true"]');
    expect(ecuadorRow).not.toBeNull();
    expect(ecuadorRow).toHaveAttribute("aria-current", "true");
    expect(rows.at(-1)).toHaveTextContent("World");
    expect(rows.at(-1)).toHaveTextContent("No data");
  });

  it("defaults to the latest year with at least five geographies", async () => {
    renderCompare("/compare/ranking");
    const select = await screen.findByRole("combobox", { name: "Year" });
    expect(select).toHaveValue("2004");
    const options = within(select)
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["2000", "2001", "2002", "2003", "2004"]);
  });

  it("changes the ranked year through the URL", async () => {
    renderCompare("/compare/ranking");
    const select = await screen.findByRole("combobox", { name: "Year" });
    await userEvent.selectOptions(select, "2003");
    expect(screen.getByTestId("location")).toHaveTextContent("y=2003");
    await userEvent.click(screen.getByRole("radio", { name: "Data table" }));
    const rows = within(await screen.findByRole("table")).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("World");
    expect(rows[1]).toHaveTextContent("$1,000");
  });

  it("draws a ranking chart with Ecuador highlighted", async () => {
    const { renderer } = renderCompare("/compare/ranking");
    await screen.findByRole("group", { name: /ranking in 2004/i });
    const option = lastOption(renderer) as unknown as {
      readonly yAxis: { readonly data: readonly string[] };
      readonly series: readonly {
        readonly data: readonly { readonly itemStyle?: { readonly color?: string } }[];
      }[];
    };
    expect(option.yAxis.data).toEqual([
      "Peru",
      "Ecuador",
      "Colombia",
      "Chile",
      "Bolivia",
      "Latin America & Caribbean",
    ]);
  });

  it.each(["light", "dark"] as const)(
    "passes axe on the ranking tab in the %s theme",
    async (theme) => {
      document.documentElement.dataset.theme = theme;
      renderCompare("/compare/ranking");
      await screen.findByRole("combobox", { name: "Year" });
      await expectNoA11yViolations(document.body);
    },
  );
});
