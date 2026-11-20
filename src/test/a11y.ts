/**
 * Axe helper for component-level accessibility scans (S11).
 *
 * Browser E2E scans (T11) cover real layout and contrast; this helper catches
 * landmark, name/role/value and keyboard issues in jsdom.
 */

import axe from "axe-core";
import { expect } from "vitest";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] as const;

/** Runs axe and fails with the rule ids and offending HTML when violated. */
export async function expectNoA11yViolations(container: Element = document.body): Promise<void> {
  const results = await axe.run(container, {
    runOnly: { type: "tag", values: [...TAGS] },
  });
  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary).toEqual([]);
}
