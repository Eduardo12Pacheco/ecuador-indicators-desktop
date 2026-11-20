import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appError } from "../../core/domain/errors";
import { err, ok } from "../../core/domain/result";
import { expectNoA11yViolations } from "../../test/a11y";
import { makeDatasetInfo } from "../../test/factories";
import { createFakePorts } from "../../test/fake-ports";
import { applyTheme } from "../../ui/design/theme";
import { AppProviders } from "../providers";
import { appRoutes } from "../router";
import { AppShell } from "./AppShell";

function LocationEcho() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderShell(route = "/explore/NY.GDP.MKTP.CD") {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <Outlet />
            <LocationEcho />
          </>
        ),
        children: appRoutes(),
      },
    ],
    { initialEntries: [route] },
  );
  return render(
    <AppProviders ports={createFakePorts()}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = "en";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe("AppShell", () => {
  it("renders the four landmarks and the active navigation item", async () => {
    renderShell();
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
    expect(await screen.findByText("World Development Indicators")).toBeInTheDocument();
  });

  it("puts the skip link first in the tab order and focuses main", async () => {
    renderShell();
    await userEvent.tab();
    const skip = screen.getByRole("link", { name: "Skip to main content" });
    expect(skip).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("collapses the sidebar below 1100 px", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      })),
    );
    const { container } = renderShell();
    await waitFor(() =>
      expect(container.querySelector("aside")?.getAttribute("data-collapsed")).toBe("true"),
    );
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explore" })).toBeInTheDocument();
  });

  it("toggles the theme and switches language without a reload", async () => {
    renderShell();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    await userEvent.click(screen.getByRole("button", { name: "Toggle light and dark theme" }));
    expect(document.documentElement.dataset.theme).toBe("dark");

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Change language" }), "es");
    expect(screen.getByRole("link", { name: "Explorar" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("es");
  });

  it("is axe-clean in both themes", async () => {
    applyTheme("light");
    renderShell();
    await screen.findByText("World Development Indicators");
    await expectNoA11yViolations(document.body);
  });

  it("is axe-clean in the dark theme", async () => {
    applyTheme("dark");
    renderShell();
    await screen.findByText("World Development Indicators");
    await expectNoA11yViolations(document.body);
  });
});

describe("AppShell global shortcuts", () => {
  it("opens the command palette with Control+K", async () => {
    renderShell();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("opens the keyboard shortcut help with ?", async () => {
    renderShell();
    await userEvent.keyboard("?");
    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Open command palette" })).toBeInTheDocument();
  });

  it("changes the Explore indicator with the bracket keys", async () => {
    renderShell("/explore/NY.GDP.MKTP.CD");
    await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 });
    await userEvent.keyboard("]");
    expect(
      await screen.findByRole("heading", {
        name: "Inflation, consumer prices (annual %)",
        level: 1,
      }),
    ).toBeInTheDocument();
  });

  it("keeps the Explore geographies when the palette picks an indicator", async () => {
    renderShell("/explore/NY.GDP.MKTP.CD?g=ECU%2CCOL");
    await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 });
    await userEvent.keyboard("{Control>}k{/Control}");
    await screen.findByRole("dialog", { name: "Command palette" });
    await userEvent.type(screen.getByRole("combobox", { name: "Command palette" }), "inflation");
    await screen.findByRole("option", { name: /Inflation, consumer prices/ });
    await userEvent.keyboard("{Enter}");
    expect(
      await screen.findByRole("heading", {
        name: "Inflation, consumer prices (annual %)",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/explore/FP.CPI.TOTL.ZG?g=ECU%2CCOL");
  });

  it("opens the save-view dialog with Control+S", async () => {
    renderShell("/explore/NY.GDP.MKTP.CD?g=ECU%2CCOL");
    await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 });
    await userEvent.keyboard("{Control>}s{/Control}");
    expect(await screen.findByRole("dialog", { name: "Save view" })).toBeInTheDocument();
    const input = await screen.findByLabelText("View name");
    await waitFor(() => expect(input).toHaveValue("GDP (current US$) · Ecuador, Colombia"));
  });

  it("navigates with the g chord", async () => {
    renderShell("/settings");
    await screen.findByRole("heading", { name: "Settings" });
    await userEvent.keyboard("g");
    await userEvent.keyboard("e");
    expect(
      await screen.findByRole("heading", { name: "GDP (current US$)", level: 1 }),
    ).toBeInTheDocument();
  });
});

describe("AppShell dataset failure", () => {
  it("shows the dataset problem screen and recovers on reset", async () => {
    let failing = true;
    const base = createFakePorts();
    const ports = createFakePorts({
      dataset: {
        ...base.dataset,
        getInfo: async () =>
          failing ? err(appError("SNAPSHOT_INVALID", "bad file")) : ok(makeDatasetInfo()),
        resetSnapshot: async () => {
          failing = false;
          return ok(makeDatasetInfo());
        },
      },
    });
    const router = createMemoryRouter([{ element: <Outlet />, children: appRoutes() }], {
      initialEntries: ["/explore/NY.GDP.MKTP.CD"],
    });
    render(
      <AppProviders ports={ports}>
        <RouterProvider router={router} />
      </AppProviders>,
    );
    expect(await screen.findByRole("heading", { name: "Dataset problem" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reset to bundled snapshot" }));
    expect(
      await screen.findByRole("navigation", { name: "Primary navigation" }),
    ).toBeInTheDocument();
  });
});

describe("AppShell route rendering", () => {
  it("renders the placeholder for the current route", async () => {
    renderShell("/settings");
    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
  });
});

void AppShell;
