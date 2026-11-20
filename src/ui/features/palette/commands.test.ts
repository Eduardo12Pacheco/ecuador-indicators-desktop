import { describe, expect, it } from "vitest";

import { indicatorCode, iso3, year } from "../../../core/domain/model";
import { toSearchActions, viewSpecPath } from "./commands";

describe("viewSpecPath", () => {
  it("reopens an Explore view from its stored spec", () => {
    const path = viewSpecPath({
      kind: "explore",
      indicator: indicatorCode("NY.GDP.MKTP.CD"),
      geographies: [iso3("ECU"), iso3("COL")],
      from: year(2000),
      to: year(2020),
      transform: "index",
      baseYear: year(2000),
      chart: "bar",
    });
    expect(path).toBe(
      "/explore/NY.GDP.MKTP.CD?g=ECU%2CCOL&from=2000&to=2020&t=index&base=2000&ch=bar",
    );
  });

  it("reopens trajectories and ranking views", () => {
    expect(
      viewSpecPath({
        kind: "trajectories",
        indicators: [indicatorCode("NY.GDP.MKTP.CD"), indicatorCode("FP.CPI.TOTL.ZG")],
        geography: iso3("COL"),
        baseYear: year(2001),
      }),
    ).toBe("/compare/trajectories?i=NY.GDP.MKTP.CD%2CFP.CPI.TOTL.ZG&g=COL&base=2001");
    expect(
      viewSpecPath({
        kind: "ranking",
        indicator: indicatorCode("NY.GDP.MKTP.CD"),
        year: year(2020),
      }),
    ).toBe("/compare/ranking?i=NY.GDP.MKTP.CD&y=2020");
  });

  it("builds search actions from translated command titles and keywords", () => {
    expect(
      toSearchActions([{ id: "go-explore", title: "Go to Explore", keywords: ["explorar"] }]),
    ).toEqual([{ id: "go-explore", keywords: ["Go to Explore", "explorar"] }]);
  });
});
