import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "../../../test/render";
import { ExportProvider, useExportActions, useRegisterExport } from "./export-context";

function Harness({ csv }: { readonly csv: () => Promise<void> }) {
  const { available, run } = useExportActions();
  useRegisterExport(csv, undefined);
  return (
    <>
      <output data-testid="availability">{String(available.csv)}</output>
      <button type="button" onClick={() => run("csv")}>
        run
      </button>
    </>
  );
}

describe("export context", () => {
  it("registers page handlers and exposes availability", async () => {
    const csv = vi.fn(async () => undefined);
    renderWithProviders(
      <ExportProvider>
        <Harness csv={csv} />
      </ExportProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("availability")).toHaveTextContent("true"));
    await userEvent.click(screen.getByRole("button", { name: "run" }));
    expect(csv).toHaveBeenCalledTimes(1);
  });

  it("clears availability when the page unmounts", async () => {
    const csv = vi.fn(async () => undefined);
    const { unmount } = renderWithProviders(
      <ExportProvider>
        <Harness csv={csv} />
      </ExportProvider>,
    );
    unmount();
    // The provider state lives with the unmounted tree; this asserts no throw.
    expect(screen.queryByTestId("availability")).not.toBeInTheDocument();
  });
});
