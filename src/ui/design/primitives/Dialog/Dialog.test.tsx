import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { Button } from "../Button/Button";
import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("traps focus, labels itself and closes on Escape returning focus", async () => {
    render(
      <I18nProvider>
        <Dialog trigger={<Button>Save view</Button>} title="Save view" description="Name it">
          <input aria-label="View name" />
        </Dialog>
      </I18nProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Save view" });
    await userEvent.click(trigger);
    const dialog = await screen.findByRole("dialog", { name: "Save view" });
    expect(dialog).toHaveAccessibleDescription("Name it");
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it("has an explicit close button", async () => {
    render(
      <I18nProvider>
        <Dialog trigger={<Button>Open</Button>} title="About">
          body
        </Dialog>
      </I18nProvider>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
