import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { appError } from "../../../core/domain/errors";
import {
  indicatorCode,
  iso3,
  type SavedView,
  type ViewSpec,
  year,
} from "../../../core/domain/model";
import { err, ok, type Result } from "../../../core/domain/result";
import { makeSavedView, makeSettings } from "../../../test/factories";
import { createFakePorts } from "../../../test/fake-ports";
import { renderWithProviders } from "../../../test/render";
import { SaveViewDialog } from "./SaveViewDialog";

const spec: ViewSpec = {
  kind: "explore",
  indicator: indicatorCode("NY.GDP.MKTP.CD"),
  geographies: [iso3("ECU"), iso3("COL")],
  from: year(2000),
  to: year(2020),
  transform: "level",
  baseYear: null,
  chart: "line",
};

const existing: SavedView = makeSavedView({ id: "view-7", name: "My GDP view", spec });

function setup(
  options: {
    readonly existing?: SavedView | null;
    readonly views?: readonly SavedView[];
    readonly create?: () => Promise<Result<SavedView>>;
    readonly update?: () => Promise<Result<SavedView>>;
  } = {},
) {
  const onOpenChange = vi.fn();
  const create = vi.fn(
    options.create ?? (() => Promise.resolve(ok(makeSavedView({ name: "Saved" })))),
  );
  const update = vi.fn(
    options.update ?? (() => Promise.resolve(ok(makeSavedView({ name: "Updated" })))),
  );
  const ports = createFakePorts({
    views: {
      list: async () => ok(options.views ?? (options.existing ? [options.existing] : [])),
      create,
      update,
      remove: async () => ok(undefined),
    },
    settings: { get: async () => ok(makeSettings()), set: async () => ok(undefined) },
  });
  renderWithProviders(
    <SaveViewDialog
      open
      onOpenChange={onOpenChange}
      spec={spec}
      existing={options.existing ?? null}
    />,
    { ports },
  );
  return { onOpenChange, create, update };
}

describe("SaveViewDialog", () => {
  it("prefills the name from the indicator and geographies", async () => {
    setup();
    const input = screen.getByLabelText("View name");
    await waitFor(() => expect(input).toHaveValue("GDP (current US$) · Ecuador, Colombia"));
  });

  it("creates a view, announces success and closes", async () => {
    const { create, onOpenChange } = setup();
    const input = screen.getByLabelText("View name");
    await waitFor(() => expect(input).not.toHaveValue(""));
    await userEvent.clear(input);
    await userEvent.type(input, "  GDP in Ecuador  ");
    await userEvent.click(screen.getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: "GDP in Ecuador", spec }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(await screen.findByText("Saved “Saved”")).toBeInTheDocument();
  });

  it("rejects an empty name without calling the repository", async () => {
    const { create } = setup();
    const input = screen.getByLabelText("View name");
    await waitFor(() => expect(input).not.toHaveValue(""));
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole("button", { name: "Save view" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter between 1 and 80 characters.",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("updates the existing view or saves it as new", async () => {
    const { update, create } = setup({ existing });
    await waitFor(() => expect(screen.getByLabelText("View name")).toHaveValue("My GDP view"));
    await userEvent.click(screen.getByRole("button", { name: "Update “My GDP view”" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith("view-7", { name: "My GDP view", spec }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save as new" }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: "My GDP view", spec }));
  });

  it("explains the 200-view limit before creating", async () => {
    const views = Array.from({ length: 200 }, (_, index) =>
      makeSavedView({ id: `view-${index}`, name: `View ${index}` }),
    );
    const { create } = setup({ views });
    await waitFor(() => expect(screen.getByLabelText("View name")).not.toHaveValue(""));
    await userEvent.click(screen.getByRole("button", { name: "Save view" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("limit of 200 saved views");
    expect(create).not.toHaveBeenCalled();
  });

  it("maps backend validation errors to the translated message", async () => {
    const { create } = setup({
      create: async () => err(appError("VIEW_INVALID", "name must contain 1 to 80 characters")),
    });
    await waitFor(() => expect(screen.getByLabelText("View name")).not.toHaveValue(""));
    await userEvent.click(screen.getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Enter between 1 and 80 characters.",
    );
  });
});
