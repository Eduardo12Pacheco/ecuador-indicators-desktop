import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { LiveRegion } from "./LiveRegion";

describe("LiveRegion", () => {
  it("is a polite status region by default", () => {
    render(
      <I18nProvider>
        <LiveRegion>Ecuador, 2024: 1,234</LiveRegion>
      </I18nProvider>,
    );
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region).toHaveTextContent("Ecuador, 2024: 1,234");
  });

  it("supports an assertive announcement", () => {
    render(
      <I18nProvider>
        <LiveRegion assertive>Snapshot invalid</LiveRegion>
      </I18nProvider>,
    );
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "assertive");
  });
});
