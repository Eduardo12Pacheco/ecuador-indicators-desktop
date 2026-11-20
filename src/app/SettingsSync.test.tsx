import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appError } from "../core/domain/errors";
import type { Settings } from "../core/domain/model";
import { err, ok, type Result } from "../core/domain/result";
import { makeSettings } from "../test/factories";
import { createFakePorts } from "../test/fake-ports";
import { renderWithProviders } from "../test/render";
import { useTheme } from "../ui/design/ThemeProvider";
import { useT } from "../ui/i18n/useT";
import { LanguageSwitch } from "./shell/LanguageSwitch";
import { ThemeToggle } from "./shell/ThemeToggle";

function Probe() {
  const { pref } = useTheme();
  const { lang } = useT();
  return <output data-testid="probe">{`${pref}/${lang}`}</output>;
}

function setup(stored: Settings, saveResult: Result<void> = ok(undefined)) {
  const get = vi.fn(async () => ok(stored));
  const set = vi.fn(async (_next: Settings) => saveResult);
  const ports = createFakePorts({ settings: { get, set } });
  renderWithProviders(
    <>
      <ThemeToggle />
      <LanguageSwitch />
      <Probe />
    </>,
    { ports },
  );
  return { get, set };
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("SettingsSync", () => {
  it("applies the stored document without writing it back", async () => {
    localStorage.setItem("ei:theme", "dark");
    const { get, set } = setup(makeSettings({ theme: "light", language: "en" }));
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("light/en"));
    expect(get).toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("persists a theme change made from the top bar", async () => {
    const { get, set } = setup(makeSettings({ theme: "light", language: "en" }));
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("light/en"));

    await userEvent.click(screen.getByRole("button", { name: "Toggle light and dark theme" }));

    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ theme: "dark", language: "en" })),
    );
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("persists a language change made from the top bar", async () => {
    const { get, set } = setup(makeSettings({ theme: "light", language: "en" }));
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("light/en"));

    await userEvent.selectOptions(screen.getByRole("combobox"), "es");

    await waitFor(() =>
      expect(set).toHaveBeenCalledWith(expect.objectContaining({ theme: "light", language: "es" })),
    );
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("tells the user when a change cannot be saved", async () => {
    const { get, set } = setup(
      makeSettings({ theme: "light", language: "en" }),
      err(appError("STORAGE", "disk full")),
    );
    await waitFor(() => expect(get).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("probe")).toHaveTextContent("light/en"));

    await userEvent.click(screen.getByRole("button", { name: "Toggle light and dark theme" }));

    await waitFor(() => expect(set).toHaveBeenCalled());
    expect(await screen.findByText("The setting could not be saved.")).toBeInTheDocument();
  });
});
