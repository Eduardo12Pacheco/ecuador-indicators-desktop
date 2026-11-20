import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../i18n/I18nProvider";
import { ExportMenu } from "./ExportMenu";

function renderMenu(available: { csv: boolean; png: boolean }) {
  const onExport = vi.fn();
  render(
    <I18nProvider>
      <ExportMenu available={available} busy={null} onExport={onExport} />
    </I18nProvider>,
  );
  return onExport;
}

describe("ExportMenu", () => {
  it("disables both actions when the page has nothing to export", () => {
    renderMenu({ csv: false, png: false });
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Export CSV" })).toHaveAttribute(
      "title",
      "There is nothing visible to export on this page.",
    );
  });

  it("runs the requested export", async () => {
    const onExport = renderMenu({ csv: true, png: true });
    await userEvent.click(screen.getByRole("button", { name: "Export PNG" }));
    expect(onExport).toHaveBeenCalledWith("png");
  });
});
