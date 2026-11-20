/**
 * The only global keydown listener in the application (D26).
 *
 * It resolves a pressed key into a canonical stroke, handles the `g` chord with
 * a one-second timeout, ignores typing contexts and open dialogs (except
 * `Mod+K`), and delegates the work to the command registry.
 */

import { useEffect, useRef } from "react";

import {
  availableCommands,
  COMMANDS,
  type Command,
  type CommandContext,
  parseShortcut,
  resolveShortcut,
} from "./registry";

/** Chord timeout from D26. */
export const CHORD_TIMEOUT_MS = 1000;

const MODIFIER_KEYS = new Set(["Control", "Meta", "Shift", "Alt", "CapsLock"]);

/** Structural subset of a keyboard event, which keeps the resolver testable. */
export type KeyboardLike = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

/** Canonical stroke for an event, or `null` for modifier-only keys. */
export function strokeForEvent(event: KeyboardLike): string | null {
  if (event.key === "" || MODIFIER_KEYS.has(event.key)) {
    return null;
  }
  const parts: string[] = [];
  if (event.ctrlKey) parts.push("ctrl");
  if (event.metaKey) parts.push("meta");
  if (event.altKey) parts.push("alt");
  const isQuestionMark = event.key === "?";
  if (event.shiftKey && !isQuestionMark) parts.push("shift");
  parts.push(event.key.toLowerCase());
  return parts.join("+");
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (target === null || !(target instanceof HTMLElement)) {
    return false;
  }
  if (target.isContentEditable) {
    return true;
  }
  return (
    target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']") !==
    null
  );
}

function dialogIsOpen(): boolean {
  return typeof document !== "undefined" && document.querySelector('[role="dialog"]') !== null;
}

/** Inputs for {@link useShortcuts}. */
export interface UseShortcutsOptions {
  readonly context: CommandContext;
  readonly commands?: readonly Command[];
  readonly chordTimeoutMs?: number;
}

/**
 * Installs the window keydown listener for the lifetime of the component.
 *
 * The latest context and command list are kept in refs so a re-render never
 * drops a pending chord or re-subscribes the listener.
 */
export function useShortcuts({
  context,
  commands = COMMANDS,
  chordTimeoutMs = CHORD_TIMEOUT_MS,
}: UseShortcutsOptions): void {
  const contextRef = useRef(context);
  contextRef.current = context;
  const commandsRef = useRef(commands);
  commandsRef.current = commands;

  useEffect(() => {
    interface PendingChord {
      readonly command: Command;
      readonly next: string;
      readonly timer: number;
    }
    let pending: PendingChord | null = null;
    let timer: number | null = null;

    const clearPending = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      pending = null;
    };

    const run = (command: Command, current: CommandContext) => {
      clearPending();
      command.run(current);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return;
      }
      const current = contextRef.current;
      const stroke = strokeForEvent(event);
      if (stroke === null) {
        return;
      }

      if (stroke === resolveShortcut("Mod+K", current.platform)) {
        event.preventDefault();
        clearPending();
        current.openPalette();
        return;
      }

      if (stroke === "escape") {
        clearPending();
        return;
      }

      if (isEditableTarget(event.target) || dialogIsOpen()) {
        return;
      }

      if (pending !== null) {
        const chord = pending;
        if (stroke === chord.next) {
          event.preventDefault();
          run(chord.command, current);
          return;
        }
        clearPending();
      }

      const active = availableCommands(current);
      const chordStart = active.find((command) => {
        if (command.shortcut === undefined) {
          return false;
        }
        const strokes = parseShortcut(command.shortcut);
        return (
          strokes.length === 2 && resolveShortcut(strokes[0] ?? "", current.platform) === stroke
        );
      });
      if (chordStart?.shortcut !== undefined) {
        event.preventDefault();
        const nextStroke = parseShortcut(chordStart.shortcut)[1] ?? "";
        pending = {
          command: chordStart,
          next: resolveShortcut(nextStroke, current.platform),
          timer: 0,
        };
        timer = window.setTimeout(clearPending, chordTimeoutMs);
        return;
      }

      const single = active.find(
        (command) =>
          command.shortcut !== undefined &&
          parseShortcut(command.shortcut).length === 1 &&
          resolveShortcut(command.shortcut, current.platform) === stroke,
      );
      if (single !== undefined) {
        event.preventDefault();
        run(single, current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearPending();
    };
  }, [chordTimeoutMs]);
}
