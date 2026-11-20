import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DOWNLOAD_STARTED, SAVE_CANCELLED } from "../../../core/application/ports";
import type { ExploreModel } from "../../../core/application/use-cases/models";
import { appError } from "../../../core/domain/errors";
import { year } from "../../../core/domain/model";
import { err, ok } from "../../../core/domain/result";
import { makeGeography, makeIndicator, makeSeries } from "../../../test/factories";
import { FakeChartRenderer } from "../../../test/fake-chart-renderer";
import { createFakePorts } from "../../../test/fake-ports";
import { renderWithProviders } from "../../../test/render";
import { chartThemeFor } from "../../charts/chart-theme";
import { useExport } from "./use-export";

const indicator = makeIndicator();
const geography = makeGeography();

function model(): ExploreModel {
  return {
    indicator,
    geographies: [geography],
    series: [
      makeSeries(
        [
          [2000, 100],
          [2001, 110],
        ],
        { indicator, geography },
      ),
    ],
    transform: "level",
    baseYear: null,
    from: null,
    to: null,
    chart: "line",
  };
}

function Harness({ renderer }: { readonly renderer: FakeChartRenderer | null }) {
  const exports = useExport({
    model: model(),
    renderer,
    theme: chartThemeFor("light"),
    locale: "en-US",
    lang: "en",
  });
  return (
    <>
      <button type="button" onClick={() => void exports.exportCsv()}>
        csv
      </button>
      <button type="button" onClick={() => void exports.exportPng()}>
        png
      </button>
      <output data-testid="available">
        {exports.available.csv ? "csv" : ""}
        {exports.available.png ? "png" : ""}
      </output>
    </>
  );
}

function setup(result: Awaited<ReturnType<ReturnType<typeof createFakePorts>["export"]["save"]>>) {
  const requests: Parameters<ReturnType<typeof createFakePorts>["export"]["save"]>[0][] = [];
  const base = createFakePorts();
  const ports = createFakePorts({
    dataset: {
      ...base.dataset,
      getObservations: async () =>
        ok([
          { indicatorCode: indicator.code, iso3: geography.iso3, year: year(2000), value: 100 },
          { indicatorCode: indicator.code, iso3: geography.iso3, year: year(2001), value: 110 },
        ]),
    },
    export: {
      save: async (request) => {
        requests.push(request);
        return result;
      },
    },
  });
  const renderer = new FakeChartRenderer();
  renderWithProviders(<Harness renderer={renderer} />, { ports });
  return { requests, renderer };
}

describe("useExport", () => {
  it("exports the visible observations as CSV through the save gateway", async () => {
    const { requests } = setup(ok("/tmp/out.csv"));
    await waitFor(() => expect(screen.getByTestId("available")).toHaveTextContent("csvpng"));
    await userEvent.click(screen.getByRole("button", { name: "csv" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.kind).toBe("csv");
    expect(requests[0]?.suggestedName).toBe("ecuador-NY.GDP.MKTP.CD-2000-2001.csv");
    expect(String(requests[0]?.content)).toContain(
      "indicator_code,indicator_name,iso3,geography,year,value,unit",
    );
    expect(await screen.findByText("Saved to /tmp/out.csv")).toBeInTheDocument();
  });

  it("exports a 2x PNG built from the chart renderer", async () => {
    const { requests, renderer } = setup(ok("/tmp/out.png"));
    await waitFor(() => expect(screen.getByTestId("available")).toHaveTextContent("csvpng"));
    await userEvent.click(screen.getByRole("button", { name: "png" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.kind).toBe("png");
    expect(requests[0]?.suggestedName).toBe("ecuador-NY.GDP.MKTP.CD-2000-2001.png");
    expect(renderer.dataUrlOperations[0]?.pixelRatio).toBe(2);
    expect(Array.from(requests[0]?.content as Uint8Array).slice(0, 4)).toEqual([
      0x89, 0x50, 0x4e, 0x47,
    ]);
  });

  it("stays silent when the user cancels the dialog", async () => {
    const { requests } = setup(ok(SAVE_CANCELLED));
    await waitFor(() => expect(screen.getByTestId("available")).toHaveTextContent("csvpng"));
    await userEvent.click(screen.getByRole("button", { name: "png" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(screen.queryByText(/cancelled/)).not.toBeInTheDocument();
  });

  it("announces downloads and failures", async () => {
    setup(ok(DOWNLOAD_STARTED));
    await waitFor(() => expect(screen.getByTestId("available")).toHaveTextContent("csvpng"));
    await userEvent.click(screen.getByRole("button", { name: "csv" }));
    expect(await screen.findByText("Download started")).toBeInTheDocument();
  });

  it("surfaces export errors with their stable code", async () => {
    const { requests } = setup(err(appError("EXPORT_REJECTED", "only .csv or .png paths")));
    await waitFor(() => expect(screen.getByTestId("available")).toHaveTextContent("csvpng"));
    await userEvent.click(screen.getByRole("button", { name: "csv" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(await screen.findByText("The export failed")).toBeInTheDocument();
  });
});
