import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { expectNoA11yViolations } from "../../../../test/a11y";
import { renderWithProviders } from "../../../../test/render";
import { applyTheme } from "../../theme";
import { DesignGallery } from "./DesignGallery";

function renderGallery() {
  return renderWithProviders(
    <main>
      <DesignGallery />
    </main>,
  );
}

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("DesignGallery", () => {
  it("shows every primitive and token swatch", async () => {
    renderGallery();
    expect(screen.getByRole("heading", { name: "Design system", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Buttons" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open dialog" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Ranking" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Check for updates" })).toBeInTheDocument();
    expect(screen.getAllByRole("slider")).toHaveLength(2);
    expect(screen.getByText("color-primary")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Overlays" })).toBeInTheDocument();
  });

  it("is axe-clean in the light theme", async () => {
    applyTheme("light");
    renderGallery();
    await expectNoA11yViolations(document.body);
  });

  it("is axe-clean in the dark theme", async () => {
    applyTheme("dark");
    renderGallery();
    await expectNoA11yViolations(document.body);
  });
});
