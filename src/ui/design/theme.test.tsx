import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ThemePref } from "../../core/domain/model";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { applyTheme, resolveTheme } from "./theme";

interface MediaQueryListStub {
  matches: boolean;
  media: string;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
  dispatch: () => void;
}

function stubMatchMedia(matches: boolean): MediaQueryListStub {
  const listeners = new Set<() => void>();
  const query: MediaQueryListStub = {
    matches,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type, listener) => listeners.add(listener),
    removeEventListener: (_type, listener) => listeners.delete(listener),
    dispatch: () => {
      for (const listener of listeners) listener();
    },
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return query;
}

function ThemeProbe() {
  const { pref, resolved, setPref, toggle } = useTheme();
  return (
    <div>
      <span data-testid="pref">{pref}</span>
      <span data-testid="resolved">{resolved}</span>
      <button type="button" onClick={() => setPref("light")}>
        light
      </button>
      <button type="button" onClick={() => setPref("system")}>
        system
      </button>
      <button type="button" onClick={toggle}>
        toggle
      </button>
    </div>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("resolveTheme", () => {
  it.each([
    ["light", "light", "light"],
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
    ["dark", "dark", "dark"],
    ["system", "light", "light"],
    ["system", "dark", "dark"],
  ] as const)("resolves %s with a %s system preference to %s", (pref, system, expected) => {
    expect(resolveTheme(pref as ThemePref, system)).toBe(expected);
  });
});

describe("applyTheme", () => {
  it("sets data-theme only for an explicit preference", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});

describe("ThemeProvider", () => {
  it("mirrors the stored preference and applies it on mount", () => {
    stubMatchMedia(false);
    localStorage.setItem("ei:theme", "dark");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("pref").textContent).toBe("dark");
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("follows the system preference while the preference is system", () => {
    const query = stubMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.dataset.theme).toBeUndefined();

    query.matches = true;
    act(() => query.dispatch());
    expect(screen.getByTestId("resolved").textContent).toBe("dark");
  });

  it("persists an explicit preference and removes the attribute for system", () => {
    stubMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    act(() => screen.getByRole("button", { name: "light" }).click());
    expect(localStorage.getItem("ei:theme")).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => screen.getByRole("button", { name: "system" }).click());
    expect(localStorage.getItem("ei:theme")).toBe("system");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("toggles between explicit light and dark", () => {
    stubMatchMedia(false);
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    act(() => screen.getByRole("button", { name: "toggle" }).click());
    expect(screen.getByTestId("pref").textContent).toBe("dark");
    act(() => screen.getByRole("button", { name: "toggle" }).click());
    expect(screen.getByTestId("pref").textContent).toBe("light");
  });

  it("ignores an invalid stored preference", () => {
    stubMatchMedia(false);
    localStorage.setItem("ei:theme", "sepia");
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("pref").textContent).toBe("system");
  });
});
