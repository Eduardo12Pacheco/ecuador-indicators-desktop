import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appError } from "../../../core/domain/errors";
import type { DatasetInfo, Settings, UpdateStatus } from "../../../core/domain/model";
import { err, ok, type Result } from "../../../core/domain/result";
import { makeAppInfo, makeDatasetInfo, makeSettings } from "../../../test/factories";
import { createFakePorts } from "../../../test/fake-ports";
import { renderWithProviders } from "../../../test/render";
import { SettingsPage } from "./SettingsPage";

function setup(
  options: {
    readonly settings?: Settings;
    readonly updateStatus?: UpdateStatus;
    readonly openSnapshotResult?: Result<DatasetInfo>;
    readonly picked?: string | null;
  } = {},
) {
  let settings = options.settings ?? makeSettings();
  const set = vi.fn(async (next: Settings) => {
    settings = next;
    return ok(undefined);
  });
  const check = vi.fn(
    async (): Promise<Result<UpdateStatus>> =>
      ok(options.updateStatus ?? { kind: "disabled", current: "0.1.0" }),
  );
  const externalOpen = vi.fn(async () => ok(undefined));
  const openSnapshot = vi.fn(
    async (): Promise<Result<DatasetInfo>> => options.openSnapshotResult ?? ok(makeDatasetInfo()),
  );
  const resetSnapshot = vi.fn(async () => ok(makeDatasetInfo()));
  const ports = createFakePorts({
    settings: { get: async () => ok(settings), set },
    updates: { check },
    externalLinks: { open: externalOpen },
    snapshotPicker: { pickSnapshot: async () => ok(options.picked ?? null) },
    dataset: {
      getInfo: async () => ok(makeDatasetInfo()),
      getCatalog: async () => ok({ topics: [], geographies: [], indicators: [] }),
      getObservations: async () => ok([]),
      openSnapshot,
      resetSnapshot,
    },
    appInfo: { get: async () => ok(makeAppInfo()) },
  });
  renderWithProviders(<SettingsPage />, { ports });
  return { set, check, externalOpen, openSnapshot, resetSnapshot, ports };
}

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("SettingsPage", () => {
  it("update check is off by default", async () => {
    setup();
    const toggle = await screen.findByRole("switch", {
      name: "Check for updates at launch",
    });
    expect(toggle).not.toBeChecked();
  });

  it("applies and persists the theme immediately", async () => {
    const { set } = setup();
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    await userEvent.click(screen.getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark" })),
    );
  });

  it("applies and persists the language immediately", async () => {
    const { set } = setup();
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    await userEvent.click(screen.getByRole("radio", { name: "Español" }));
    expect(document.documentElement.lang).toBe("es");
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ language: "es" })),
    );
  });

  it("turns the launch update check on", async () => {
    const { set } = setup();
    const toggle = await screen.findByRole("switch", {
      name: "Check for updates at launch",
    });
    await userEvent.click(toggle);
    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ updateCheckEnabled: true })),
    );
  });

  it("announces an available version and opens its release page", async () => {
    const { externalOpen } = setup({
      updateStatus: {
        kind: "available",
        current: "0.1.0",
        latest: "0.2.0",
        url: "https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/releases/tag/v0.2.0",
        publishedAt: null,
      },
    });
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    await userEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(await screen.findByText("Version 0.2.0 is available.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open the release page" }));
    await waitFor(() =>
      expect(externalOpen).toHaveBeenCalledWith(
        "https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/releases/tag/v0.2.0",
      ),
    );
  });

  it("announces up-to-date results", async () => {
    setup({ updateStatus: { kind: "up_to_date", current: "0.1.0" } });
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    await userEvent.click(screen.getByRole("button", { name: "Check now" }));
    expect(await screen.findByText("You are up to date (version 0.1.0).")).toBeInTheDocument();
  });

  it("keeps the previous dataset when a custom snapshot is invalid", async () => {
    const { openSnapshot } = setup({
      picked: "/tmp/bad.sqlite",
      openSnapshotResult: err(appError("SNAPSHOT_INVALID", "schema version mismatch")),
    });
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    expect(screen.getByText(/World Development Indicators/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open snapshot…" }));
    await waitFor(() => expect(openSnapshot).toHaveBeenCalledWith("/tmp/bad.sqlite"));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The snapshot could not be opened. The current dataset is unchanged.",
    );
    expect(screen.getByText(/World Development Indicators/)).toBeInTheDocument();
  });

  it("does nothing when the snapshot dialog is cancelled", async () => {
    const { openSnapshot } = setup({ picked: null });
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    await userEvent.click(screen.getByRole("button", { name: "Open snapshot…" }));
    expect(openSnapshot).not.toHaveBeenCalled();
  });

  it("resets to the bundled snapshot", async () => {
    const { resetSnapshot } = setup();
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    await userEvent.click(screen.getByRole("button", { name: "Reset to bundled" }));
    await waitFor(() => expect(resetSnapshot).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Bundled snapshot restored.")).toBeInTheDocument();
  });

  it("copies the data directory", async () => {
    const writeText = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    setup();
    await screen.findByRole("switch", { name: "Check for updates at launch" });
    const section = screen.getByRole("heading", { name: "Storage" }).closest("section");
    expect(section).not.toBeNull();
    if (section === null) {
      throw new Error("storage section is missing");
    }
    const [copyButton] = within(section).getAllByRole("button", { name: "Copy" });
    if (copyButton === undefined) {
      throw new Error("copy button is missing");
    }
    await userEvent.click(copyButton);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("/tmp/data"));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
