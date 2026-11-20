import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../../../i18n/I18nProvider";
import { Button } from "../Button/Button";
import { ToastProvider, useToast } from "./Toast";

function Launcher({ durationMs }: { readonly durationMs?: number }) {
  const { showToast } = useToast();
  return (
    <Button
      onClick={() =>
        showToast({
          title: "View saved",
          description: "GDP in Ecuador",
          ...(durationMs === undefined ? {} : { durationMs }),
        })
      }
    >
      save
    </Button>
  );
}

function setup(durationMs?: number) {
  render(
    <I18nProvider>
      <ToastProvider>
        <Launcher {...(durationMs === undefined ? {} : { durationMs })} />
      </ToastProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast", () => {
  it("announces a toast in a polite region and dismisses it manually", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "save" }));
    expect(screen.getByRole("status")).toHaveTextContent("View saved");
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("View saved")).not.toBeInTheDocument();
  });

  it("dismisses automatically after the default five seconds", async () => {
    vi.useFakeTimers();
    setup();
    act(() => screen.getByRole("button", { name: "save" }).click());
    expect(screen.getByText("View saved")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText("View saved")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.queryByText("View saved")).not.toBeInTheDocument();
  });

  it("pauses while hovered and resumes afterwards", () => {
    vi.useFakeTimers();
    setup(5000);
    act(() => screen.getByRole("button", { name: "save" }).click());
    const toast = screen.getByText("View saved").closest("[data-toast]");
    expect(toast).not.toBeNull();
    act(() => {
      toast?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByText("View saved")).toBeInTheDocument();
    act(() => {
      toast?.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    });
    act(() => {
      vi.advanceTimersByTime(5001);
    });
    expect(screen.queryByText("View saved")).not.toBeInTheDocument();
  });
});
