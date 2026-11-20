import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CommandContext } from "./registry";
import { useShortcuts } from "./use-shortcuts";

function Harness({
  context,
  chordTimeoutMs,
}: {
  readonly context: CommandContext;
  readonly chordTimeoutMs?: number;
}) {
  useShortcuts({
    context,
    ...(chordTimeoutMs === undefined ? {} : { chordTimeoutMs }),
  });
  return null;
}

interface Spies {
  readonly context: CommandContext;
  readonly openPalette: ReturnType<typeof vi.fn>;
  readonly goExplore: ReturnType<typeof vi.fn>;
  readonly openShortcuts: ReturnType<typeof vi.fn>;
  readonly toggleTheme: ReturnType<typeof vi.fn>;
  readonly setLanguage: ReturnType<typeof vi.fn>;
  readonly stepIndicator: ReturnType<typeof vi.fn>;
  readonly navigate: ReturnType<typeof vi.fn>;
}

function spies(overrides: Partial<CommandContext> = {}): Spies {
  const openPalette = vi.fn();
  const goExplore = vi.fn();
  const openShortcuts = vi.fn();
  const toggleTheme = vi.fn();
  const setLanguage = vi.fn();
  const stepIndicator = vi.fn();
  const navigate = vi.fn();
  return {
    openPalette,
    goExplore,
    openShortcuts,
    toggleTheme,
    setLanguage,
    stepIndicator,
    navigate,
    context: {
      platform: "other",
      pathname: "/explore/NY.GDP.MKTP.CD",
      navigate,
      goExplore,
      openPalette,
      openShortcuts,
      toggleTheme,
      setLanguage,
      stepIndicator,
      ...overrides,
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useShortcuts", () => {
  it("opens the palette with Control+K on non-mac platforms", () => {
    const state = spies();
    render(<Harness context={state.context} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(state.openPalette).toHaveBeenCalledTimes(1);
  });

  it("normalizes Mod to Meta on macOS", () => {
    const mac = spies({ platform: "mac" });
    render(<Harness context={mac.context} />);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(mac.openPalette).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(mac.openPalette).toHaveBeenCalledTimes(1);
  });

  it("runs a chord command (g then e) and its second stroke", () => {
    const state = spies();
    render(<Harness context={state.context} />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "e" });
    expect(state.goExplore).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending chord on another key", () => {
    const state = spies();
    render(<Harness context={state.context} />);
    fireEvent.keyDown(window, { key: "g" });
    fireEvent.keyDown(window, { key: "x" });
    fireEvent.keyDown(window, { key: "e" });
    expect(state.goExplore).not.toHaveBeenCalled();
  });

  it("expires a chord after the timeout", () => {
    vi.useFakeTimers();
    const state = spies();
    render(<Harness context={state.context} chordTimeoutMs={1000} />);
    fireEvent.keyDown(window, { key: "g" });
    vi.advanceTimersByTime(1000);
    fireEvent.keyDown(window, { key: "e" });
    expect(state.goExplore).not.toHaveBeenCalled();
  });

  it("handles bracket stepping on Explore", () => {
    const state = spies();
    render(<Harness context={state.context} />);
    fireEvent.keyDown(window, { key: "]" });
    fireEvent.keyDown(window, { key: "[" });
    expect(state.stepIndicator).toHaveBeenNthCalledWith(1, 1);
    expect(state.stepIndicator).toHaveBeenNthCalledWith(2, -1);
  });

  it("ignores shortcuts while focus is in an editable element", () => {
    const state = spies();
    const { getByRole } = render(
      <>
        <input aria-label="name" />
        <Harness context={state.context} />
      </>,
    );
    const input = getByRole("textbox", { name: "name" });
    input.focus();
    fireEvent.keyDown(input, { key: "]" });
    fireEvent.keyDown(input, { key: "?" });
    expect(state.stepIndicator).not.toHaveBeenCalled();
    expect(state.openShortcuts).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "k", ctrlKey: true });
    expect(state.openPalette).toHaveBeenCalledTimes(1);
  });

  it("ignores shortcuts while a dialog is open, except Mod+K", () => {
    const state = spies();
    render(
      <>
        <div role="dialog" aria-label="open dialog" />
        <Harness context={state.context} />
      </>,
    );
    fireEvent.keyDown(window, { key: "?" });
    expect(state.openShortcuts).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(state.openPalette).toHaveBeenCalledTimes(1);
  });

  it("toggles the theme with Mod+Shift+D", () => {
    const state = spies();
    render(<Harness context={state.context} />);
    fireEvent.keyDown(window, { key: "D", ctrlKey: true, shiftKey: true });
    expect(state.toggleTheme).toHaveBeenCalledTimes(1);
  });
});
