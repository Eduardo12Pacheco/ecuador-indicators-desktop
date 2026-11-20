import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { Slider } from "./Slider";

describe("Slider", () => {
  it("exposes two labelled thumbs and keyboard adjustment", async () => {
    const onValueChange = vi.fn();
    render(
      <I18nProvider>
        <Slider
          label="Year"
          min={1960}
          max={2025}
          value={[1980, 2000]}
          onValueChange={onValueChange}
        />
      </I18nProvider>,
    );
    const thumbs = screen.getAllByRole("slider");
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveAccessibleName("Minimum Year");
    expect(thumbs[1]).toHaveAccessibleName("Maximum Year");

    thumbs[0]?.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onValueChange).toHaveBeenCalled();
    const last = onValueChange.mock.calls.at(-1)?.[0] as [number, number];
    expect(last[0]).toBeGreaterThan(1980);
    expect(last[1]).toBe(2000);
  });
});
