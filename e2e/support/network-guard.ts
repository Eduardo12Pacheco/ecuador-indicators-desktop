import type { Page } from "@playwright/test";

/** Result of installing the guard: every aborted external URL in order. */
export interface NetworkGuard {
  readonly blockedRequests: string[];
}

/**
 * Aborts and records every request that is not part of the local preview.
 *
 * This is the S1 evidence: with the guard installed the app must complete the
 * full offline flow without trying to open a socket to any external origin.
 */
export async function guardNetwork(page: Page): Promise<NetworkGuard> {
  const blockedRequests: string[] = [];

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isLocal =
      (url.protocol === "http:" || url.protocol === "https:") &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (isLocal || url.protocol === "data:" || url.protocol === "blob:") {
      await route.continue();
      return;
    }
    blockedRequests.push(url.toString());
    await route.abort();
  });

  return { blockedRequests };
}
