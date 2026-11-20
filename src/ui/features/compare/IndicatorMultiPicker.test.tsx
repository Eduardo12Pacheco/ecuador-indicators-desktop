import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { type Indicator, indicatorCode } from "../../../core/domain/model";
import { makeIndicator } from "../../../test/factories";
import { renderWithProviders } from "../../../test/render";
import { IndicatorMultiPicker } from "./IndicatorMultiPicker";

const gdp = makeIndicator();
const inflation = makeIndicator({
  code: indicatorCode("FP.CPI.TOTL.ZG"),
  nameEn: "Inflation, consumer prices (annual %)",
  nameEs: "Inflación, precios al consumidor (% anual)",
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
  sortOrder: 22,
});
const internet = makeIndicator({
  code: indicatorCode("IT.NET.USER.ZS"),
  nameEn: "Individuals using the Internet (% of population)",
  nameEs: "Personas que usan Internet (% de la población)",
  sortOrder: 37,
});

const all: Indicator[] = [gdp, inflation, population, life, internet];

afterEach(() => {
  localStorage.clear();
});

describe("IndicatorMultiPicker", () => {
  it("adds an indicator to the selection", async () => {
    let selected = [gdp.code, inflation.code];
    renderWithProviders(
      <IndicatorMultiPicker
        indicators={all}
        selected={selected}
        onChange={(next) => {
          selected = [...next];
        }}
      />,
    );
    await userEvent.click(screen.getByRole("option", { name: "Add Population, total" }));
    expect(selected.map((code) => code)).toContain("SP.POP.TOTL");
  });

  it("enforces the four-indicator maximum and announces it", async () => {
    const selected = [gdp.code, inflation.code, population.code, life.code];
    let changes = 0;
    renderWithProviders(
      <IndicatorMultiPicker
        indicators={all}
        selected={selected}
        onChange={() => {
          changes += 1;
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("option", { name: "Add Individuals using the Internet (% of population)" }),
    );
    expect(changes).toBe(0);
    expect(screen.getByText("At most 4 indicators")).toBeInTheDocument();
  });

  it("refuses to drop below two indicators and announces it", async () => {
    let changes = 0;
    renderWithProviders(
      <IndicatorMultiPicker
        indicators={all}
        selected={[gdp.code, inflation.code]}
        onChange={() => {
          changes += 1;
        }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remove Inflation, consumer prices (annual %)" }),
    );
    expect(changes).toBe(0);
    expect(screen.getByText("Choose at least 2 indicators")).toBeInTheDocument();
  });

  it("filters by name in the active language, ignoring diacritics", async () => {
    localStorage.setItem("ei:lang", "es");
    renderWithProviders(
      <IndicatorMultiPicker
        indicators={all}
        selected={[gdp.code, inflation.code]}
        onChange={() => undefined}
      />,
    );
    await userEvent.type(
      screen.getByRole("searchbox", { name: "Filtrar indicadores" }),
      "poblacion",
    );
    expect(screen.getByRole("option", { name: "Añadir Población total" })).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "Añadir Esperanza de vida al nacer (años)" }),
    ).not.toBeInTheDocument();
  });
});
