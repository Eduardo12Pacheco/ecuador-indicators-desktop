import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("announces a default loading label", () => {
    render(
      <I18nProvider>
        <Spinner />
      </I18nProvider>,
    );
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("accepts a custom label and size", () => {
    render(
      <I18nProvider>
        <Spinner label="Refreshing" size="sm" />
      </I18nProvider>,
    );
    expect(screen.getByRole("status", { name: "Refreshing" })).toBeInTheDocument();
  });
});
