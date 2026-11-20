import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { Chip } from "./Chip";

describe("Chip", () => {
  it("renders a removable label with an accessible remove action", async () => {
    const onRemove = vi.fn();
    render(
      <I18nProvider>
        <Chip label="Colombia" onRemove={onRemove}>
          Colombia
        </Chip>
      </I18nProvider>,
    );
    expect(screen.getByText("Colombia")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Remove Colombia" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("renders without a remove action", () => {
    render(
      <I18nProvider>
        <Chip>Ecuador</Chip>
      </I18nProvider>,
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
