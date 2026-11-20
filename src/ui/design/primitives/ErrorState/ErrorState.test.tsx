import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("shows the message, a details disclosure and retries", async () => {
    const onRetry = vi.fn();
    render(
      <I18nProvider>
        <ErrorState
          title="Catalog unavailable"
          message="STORAGE: disk is busy"
          details={"at open (store.ts:42)"}
          onRetry={onRetry}
        />
      </I18nProvider>,
    );
    expect(screen.getByText("STORAGE: disk is busy")).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(screen.getByText("at open (store.ts:42)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("uses the default title when none is given", () => {
    render(
      <I18nProvider>
        <ErrorState message="boom" />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
  });
});
