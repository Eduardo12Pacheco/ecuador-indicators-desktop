import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ok } from "../../../core/domain/result";
import { expectNoA11yViolations } from "../../../test/a11y";
import { makeAppInfo, makeCatalog, makeDatasetInfo } from "../../../test/factories";
import { createFakePorts } from "../../../test/fake-ports";
import { renderWithProviders } from "../../../test/render";
import { AboutPage } from "./AboutPage";

function setup() {
  const externalOpen = vi.fn(async () => ok(undefined));
  const ports = createFakePorts({
    dataset: {
      getInfo: async () => ok(makeDatasetInfo()),
      getCatalog: async () => ok(makeCatalog()),
      getObservations: async () => ok([]),
      openSnapshot: async () => ok(makeDatasetInfo()),
      resetSnapshot: async () => ok(makeDatasetInfo()),
    },
    appInfo: { get: async () => ok(makeAppInfo({ version: "1.2.3", platform: "linux" })) },
    externalLinks: { open: externalOpen },
  });
  const view = renderWithProviders(<AboutPage />, { ports });
  return { externalOpen, ...view };
}

describe("AboutPage", () => {
  it("shows provenance, attribution and application information", async () => {
    setup();
    expect(await screen.findByText("World Development Indicators")).toBeInTheDocument();
    expect(screen.getByText("The World Bank")).toBeInTheDocument();
    expect(screen.getByText(/^Source: The World Bank\.$/)).toBeInTheDocument();
    expect(screen.getByText("1.2.3")).toBeInTheDocument();
    expect(screen.getByText(/No telemetry/)).toBeInTheDocument();
    expect(
      screen.getByText("38 indicators · 7 geographies · 11,780 observations"),
    ).toBeInTheDocument();
  });

  it("filters the indicator source table", async () => {
    setup();
    await screen.findByRole("table");
    expect(screen.getAllByRole("row")).toHaveLength(3);
    await userEvent.type(screen.getByLabelText("Filter indicators"), "inflation");
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByText("Inflation, consumer prices (annual %)")).toBeInTheDocument();
  });

  it("opens the licence page in the system browser", async () => {
    const { externalOpen } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "CC-BY-4.0" }));
    expect(externalOpen).toHaveBeenCalledWith("https://creativecommons.org/licenses/by/4.0/");
  });

  it("renders the bundled third-party notices in a dialog", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Third-party notices" }));
    const dialog = await screen.findByRole("dialog", { name: "Third-party notices" });
    expect(within(dialog).getByText(/World Bank World Development Indicators/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Creative Commons Attribution 4.0/)).toBeInTheDocument();
  });

  it("is axe-clean", async () => {
    const { container } = setup();
    await screen.findByRole("table");
    await expectNoA11yViolations(container);
  });
});
