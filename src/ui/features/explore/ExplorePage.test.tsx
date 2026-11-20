import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EChartsCoreOption } from "echarts/core";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import type { AppPorts } from "../../../core/application/ports";
import { appError } from "../../../core/domain/errors";
import {
  type Catalog,
  indicatorCode,
  iso3,
  type Observation,
  year,
} from "../../../core/domain/model";
import { err, ok, type Result } from "../../../core/domain/result";
import {
  makeCatalog,
  makeDatasetInfo,
  makeGeography,
  makeIndicator,
} from "../../../test/factories";
import { FakeChartRenderer } from "../../../test/fake-chart-renderer";
import { createFakePorts } from "../../../test/fake-ports";
import { renderWithProviders } from "../../../test/render";
import { ExplorePage } from "./ExplorePage";

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
const poverty = makeIndicator({
  code: indicatorCode("SI.POV.NAHC"),
  topicId: "labour",
  nameEn: "Poverty headcount ratio at national poverty lines (%)",
  nameEs: "Tasa de incidencia de la pobreza (%)",
  valueKind: "percent",
  sortOrder: 15,
});
const ecuador = makeGeography();
const colombia = makeGeography({
  iso3: iso3("COL"),
  iso2: "CO",
  nameEn: "Colombia",
  nameEs: "Colombia",
  sortOrder: 2,
});
const world = makeGeography({
  iso3: iso3("WLD"),
  iso2: "1W",
  nameEn: "World",
  nameEs: "Mundo",
  isAggregate: true,
  sortOrder: 7,
});

function observations(): Observation[] {
  const rows: [string, string, number, number][] = [
    ["NY.GDP.MKTP.CD", "ECU", 2000, 100],
    ["NY.GDP.MKTP.CD", "ECU", 2001, 110],
    ["NY.GDP.MKTP.CD", "ECU", 2002, 120],
    ["NY.GDP.MKTP.CD", "COL", 2000, 50],
    ["NY.GDP.MKTP.CD", "COL", 2001, 55],
    ["NY.GDP.MKTP.CD", "WLD", 2000, 1000],
    ["FP.CPI.TOTL.ZG", "ECU", 2000, 10],
    ["FP.CPI.TOTL.ZG", "ECU", 2001, 11],
    ["FP.CPI.TOTL.ZG", "ECU", 2002, 12],
    ["FP.CPI.TOTL.ZG", "COL", 2000, 5],
    ["SI.POV.NAHC", "ECU", 2020, 25],
  ];
  return rows.map(([code, geography, valueYear, value]) => ({
    indicatorCode: indicatorCode(code),
    iso3: iso3(geography),
    year: year(valueYear),
    value,
  }));
}

function ports(overrides: Partial<AppPorts> = {}): AppPorts {
  const base = createFakePorts();
  const catalog = {
    ...makeCatalog(),
    geographies: [ecuador, colombia, world],
    indicators: [gdp, inflation, poverty, population],
  };
  return createFakePorts({
    dataset: {
      getInfo: async () => ok(makeDatasetInfo()),
      getCatalog: async () => ok(catalog),
      getObservations: async (codes, iso3s) => {
        const codeSet = new Set(codes);
        const geographySet = new Set(iso3s);
        return ok(
          observations().filter(
            (row) => codeSet.has(row.indicatorCode) && geographySet.has(row.iso3),
          ),
        );
      },
      openSnapshot: base.dataset.openSnapshot,
      resetSnapshot: base.dataset.resetSnapshot,
    },
    ...overrides,
  });
}

function LocationEcho() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(path: string, appPorts: AppPorts = ports()) {
  const renderer = new FakeChartRenderer();
  const view = renderWithProviders(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/explore/:code"
          element={<ExplorePage chartRendererFactory={() => renderer} />}
        />
      </Routes>
      <LocationEcho />
    </MemoryRouter>,
    { ports: appPorts },
  );
  return { renderer, ...view };
}

function lastOption(renderer: FakeChartRenderer): {
  readonly series: { readonly type: string; readonly data: (number | null)[] }[];
} {
  const option = renderer.options[renderer.options.length - 1] as EChartsCoreOption;
  return option as unknown as {
    readonly series: { readonly type: string; readonly data: (number | null)[] }[];
  };
}

describe("ExplorePage", () => {
  it("loads the default indicator with KPIs, chart and URL state", async () => {
    const { renderer } = renderPage("/explore/NY.GDP.MKTP.CD");
    expect(
      await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/explore/NY.GDP.MKTP.CD");
    expect(await screen.findByText("Latest")).toBeInTheDocument();
    expect(
      await screen.findByRole("group", { name: /GDP \(current US\$\), Ecuador/ }),
    ).toBeInTheDocument();
    expect(lastOption(renderer).series[0]?.data).toEqual([100, 110, 120]);
  });

  it("updates the URL when controls change", async () => {
    renderPage("/explore/NY.GDP.MKTP.CD");
    await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 });
    await userEvent.click(await screen.findByRole("radio", { name: "YoY %" }));
    expect(decodeURIComponent(screen.getByTestId("location").textContent ?? "")).toContain("t=yoy");
    await userEvent.click(screen.getByRole("radio", { name: "Bar" }));
    expect(decodeURIComponent(screen.getByTestId("location").textContent ?? "")).toContain(
      "ch=bar",
    );
    await userEvent.click(screen.getByRole("radio", { name: "Data table" }));
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("adds a peer from the catalog geography list", async () => {
    renderPage("/explore/NY.GDP.MKTP.CD");
    await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 });
    await userEvent.click(await screen.findByRole("button", { name: "Add Colombia" }));
    const location = decodeURIComponent(screen.getByTestId("location").textContent ?? "");
    expect(location).toContain("g=ECU,COL");
  });

  it("restores a deep link exactly", async () => {
    const { renderer } = renderPage(
      "/explore/FP.CPI.TOTL.ZG?g=ECU%2CCOL&t=index&base=2000&from=2000&to=2002&ch=bar",
    );
    expect(
      await screen.findByRole("heading", {
        name: "Inflation, consumer prices (annual %)",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(decodeURIComponent(screen.getByTestId("location").textContent ?? "")).toBe(
      "/explore/FP.CPI.TOTL.ZG?g=ECU,COL&t=index&base=2000&from=2000&to=2002&ch=bar",
    );
    expect(await screen.findByText("Latest")).toBeInTheDocument();
    const indexed = lastOption(renderer).series[0]?.data ?? [];
    expect(indexed[0]).toBeCloseTo(100);
    expect(indexed[1]).toBeCloseTo(110);
    expect(indexed[2]).toBeCloseTo(120);
    expect(lastOption(renderer).series[0]?.type).toBe("bar");
    expect(await screen.findByLabelText("Base year")).toHaveValue("2000");
  });

  it("announces a missing peer and lets the user remove it", async () => {
    renderPage("/explore/SI.POV.NAHC?g=ECU%2CWLD");
    expect(
      await screen.findByText("No observations for World in the selected range."),
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Hide World" }));
    const location = screen.getByTestId("location").textContent ?? "";
    expect(location).toBe("/explore/SI.POV.NAHC");
    expect(screen.queryByText(/No observations for World/)).not.toBeInTheDocument();
  });

  it("shows the full empty state with recovery actions when no series has data", async () => {
    renderPage("/explore/SP.POP.TOTL?g=ECU%2CWLD");
    expect(
      await screen.findByRole("heading", { name: "No observations for this selection" }),
    ).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Remove peers" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/explore/SP.POP.TOTL");
    expect(await screen.findByRole("button", { name: "Back to GDP" })).toBeInTheDocument();
  });

  it("shows a retryable error when observations fail", async () => {
    const failing = ports({
      dataset: {
        getInfo: async () => ok(makeDatasetInfo()),
        getCatalog: async () => ok({ ...makeCatalog(), geographies: [ecuador], indicators: [gdp] }),
        getObservations: async () => err(appError("STORAGE", "database is locked")),
        openSnapshot: async () => ok(makeDatasetInfo()),
        resetSnapshot: async () => ok(makeDatasetInfo()),
      },
    });
    renderPage("/explore/NY.GDP.MKTP.CD", failing);
    expect(await screen.findByText("database is locked")).toBeInTheDocument();
    expect(screen.getByText("STORAGE: database is locked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("exports the visible range as CSV from the toolbar", async () => {
    const requests: Parameters<AppPorts["export"]["save"]>[0][] = [];
    renderPage(
      "/explore/NY.GDP.MKTP.CD?from=2000&to=2001",
      ports({
        export: {
          save: async (request) => {
            requests.push(request);
            return ok("/tmp/out.csv");
          },
        },
      }),
    );
    await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 });
    await userEvent.click(await screen.findByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.suggestedName).toBe("ecuador-NY.GDP.MKTP.CD-2000-2001.csv");
    expect(String(requests[0]?.content)).toContain("ECU");
  });

  it("shows a loading skeleton while the catalog is pending", async () => {
    let resolveCatalog: (value: Result<Catalog>) => void = () => undefined;
    const pending = new Promise<Result<Catalog>>((resolve) => {
      resolveCatalog = resolve;
    });
    const catalog = { ...makeCatalog(), geographies: [ecuador], indicators: [gdp] };
    const loading = ports({
      dataset: {
        getInfo: async () => ok(makeDatasetInfo()),
        getCatalog: () => pending,
        getObservations: async () => ok([]),
        openSnapshot: async () => ok(makeDatasetInfo()),
        resetSnapshot: async () => ok(makeDatasetInfo()),
      },
    });
    renderPage("/explore/NY.GDP.MKTP.CD", loading);
    expect((await screen.findAllByText("Loading indicator…")).length).toBeGreaterThan(0);
    await act(async () => {
      resolveCatalog(ok(catalog));
    });
    expect(
      await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 }),
    ).toBeInTheDocument();
  });
});
