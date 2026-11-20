/**
 * Test-only provider wrapper. Excluded from coverage.
 */

import { type RenderResult, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";

import { AppProviders } from "../app/providers";
import type { AppPorts } from "../core/application/ports";
import { createFakePorts } from "./fake-ports";

/** Renders UI inside query, i18n, theme, ports and toast providers. */
export function renderWithProviders(
  ui: ReactNode,
  options: { readonly ports?: AppPorts } = {},
): RenderResult {
  return render(
    <AppProviders ports={options.ports ?? createFakePorts()}>{ui as ReactElement}</AppProviders>,
  );
}
