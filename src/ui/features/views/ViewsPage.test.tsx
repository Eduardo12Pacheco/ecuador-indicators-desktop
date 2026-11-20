import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";

import type { AppPorts } from "../../../core/application/ports";
import { appError } from "../../../core/domain/errors";
import type { NewView, SavedView } from "../../../core/domain/model";
import { err, ok } from "../../../core/domain/result";
import { makeSavedView, makeSettings } from "../../../test/factories";
import { createFakePorts } from "../../../test/fake-ports";
import { renderWithProviders } from "../../../test/render";
import { ViewsPage } from "./ViewsPage";

function LocationEcho() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function setup(initial: readonly SavedView[] = [makeSavedView()]) {
  let store = [...initial];
  const remove = vi.fn(async (id: string) => {
    store = store.filter((view) => view.id !== id);
    return ok(undefined);
  });
  const update = vi.fn(async (id: string, view: NewView) => {
    const existing = store.find((candidate) => candidate.id === id);
    if (existing === undefined) {
      return err(appError("VIEW_NOT_FOUND", "missing"));
    }
    const saved: SavedView = { ...existing, ...view, name: view.name.trim(), updatedAt: 999 };
    store = store.map((candidate) => (candidate.id === id ? saved : candidate));
    return ok(saved);
  });
  const ports: AppPorts = createFakePorts({
    views: {
      list: async () => ok([...store]),
      create: async (view) => ok(makeSavedView({ ...view, id: "new" })),
      update,
      remove,
    },
    settings: { get: async () => ok(makeSettings()), set: async () => ok(undefined) },
  });
  renderWithProviders(
    <MemoryRouter initialEntries={["/views"]}>
      <Routes>
        <Route path="/views" element={<ViewsPage />} />
        <Route path="/explore/:code" element={<p>Explore route</p>} />
      </Routes>
      <LocationEcho />
    </MemoryRouter>,
    { ports },
  );
  return { remove, update };
}

describe("ViewsPage", () => {
  it("shows the first-run empty state with a call to action", async () => {
    setup([]);
    expect(await screen.findByText("No saved views yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go to Explore" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/explore");
  });

  it("renders name, kind badge and localized summary", async () => {
    setup([makeSavedView()]);
    expect(await screen.findByRole("heading", { name: "GDP in Ecuador" })).toBeInTheDocument();
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("GDP (current US$) · Ecuador")).toBeInTheDocument();
    expect(screen.getByText("1 saved view")).toBeInTheDocument();
  });

  it("opens a view at its stored URL including the view id", async () => {
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/explore/NY.GDP.MKTP.CD?view=view-1");
  });

  it("renames a view through the save dialog", async () => {
    const { update } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Rename" }));
    const input = await screen.findByLabelText("View name");
    expect(input).toHaveValue("GDP in Ecuador");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed view");
    await userEvent.click(screen.getByRole("button", { name: "Update “GDP in Ecuador”" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        "view-1",
        expect.objectContaining({
          name: "Renamed view",
        }),
      ),
    );
    expect(await screen.findByRole("heading", { name: "Renamed view" })).toBeInTheDocument();
  });

  it("deletes a view after confirmation", async () => {
    const { remove } = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(
      await screen.findByRole("dialog", { name: "Delete “GDP in Ecuador”?" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete view" }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith("view-1"));
    expect(await screen.findByText("No saved views yet")).toBeInTheDocument();
  });

  it("shows an error state with retry when the repository fails", async () => {
    let calls = 0;
    const ports = createFakePorts({
      views: {
        list: async () => {
          calls += 1;
          return err(appError("STORAGE", "database is locked"));
        },
        create: async () => err(appError("STORAGE", "database is locked")),
        update: async () => err(appError("STORAGE", "database is locked")),
        remove: async () => err(appError("STORAGE", "database is locked")),
      },
    });
    renderWithProviders(
      <MemoryRouter>
        <ViewsPage />
      </MemoryRouter>,
      { ports },
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("database is locked");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(calls).toBeGreaterThan(1));
  });
});
