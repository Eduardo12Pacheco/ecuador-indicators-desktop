import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Settings } from "../../../core/domain/model";
import { ok } from "../../../core/domain/result";
import { makeSettings } from "../../../test/factories";
import { createFakePorts } from "../../../test/fake-ports";
import { renderWithProviders } from "../../../test/render";
import { UPDATE_CHECK_INTERVAL_S, useAutoUpdateCheck } from "./use-auto-update-check";

function Harness() {
  useAutoUpdateCheck();
  return <p>launched</p>;
}

function setup(settings: Settings) {
  const check = vi.fn(async () =>
    ok({
      kind: "available" as const,
      current: "0.1.0",
      latest: "0.2.0",
      url: "https://github.com/Eduardo12Pacheco/ecuador-indicators-desktop/releases/tag/v0.2.0",
      publishedAt: null,
    }),
  );
  const ports = createFakePorts({
    settings: { get: async () => ok(settings), set: async () => ok(undefined) },
    updates: { check },
  });
  renderWithProviders(<Harness />, { ports });
  return { check };
}

describe("useAutoUpdateCheck", () => {
  it("no update request on launch when disabled", async () => {
    const { check } = setup(makeSettings({ updateCheckEnabled: false }));
    expect(await screen.findByText("launched")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("launched")).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(check).not.toHaveBeenCalled();
    expect(screen.queryByText(/Version 0.2.0 is available/)).not.toBeInTheDocument();
  });

  it("checks once at launch when enabled and the last check is stale", async () => {
    const { check } = setup(makeSettings({ updateCheckEnabled: true, lastUpdateCheck: null }));
    expect(
      await screen.findByText("Version 0.2.0 is available.", {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(false);
  });

  it("does not check again within 24 hours", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { check } = setup(makeSettings({ updateCheckEnabled: true, lastUpdateCheck: now - 60 }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(check).not.toHaveBeenCalled();
    expect(UPDATE_CHECK_INTERVAL_S).toBe(86400);
  });
});
