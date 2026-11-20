import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { Switch } from "./Switch";

function Controlled() {
  const [checked, setChecked] = useState(false);
  return (
    <I18nProvider>
      <Switch label="Check for updates" checked={checked} onCheckedChange={setChecked} />
    </I18nProvider>
  );
}

describe("Switch", () => {
  it("toggles on click and on Space", async () => {
    render(<Controlled />);
    const control = screen.getByRole("switch", { name: "Check for updates" });
    expect(control).toHaveAttribute("aria-checked", "false");
    await userEvent.click(control);
    expect(control).toHaveAttribute("aria-checked", "true");
    control.focus();
    await userEvent.keyboard(" ");
    expect(control).toHaveAttribute("aria-checked", "false");
  });
});
