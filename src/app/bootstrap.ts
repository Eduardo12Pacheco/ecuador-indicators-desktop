/**
 * Composition root for the browser side (T6).
 *
 * The adapter choice is a compile-time constant (`VITE_ADAPTER`), so Vite drops
 * the in-memory branch from the Tauri production build: no fixture URL or
 * `MemoryGateway` string ends up in `dist/`.
 */

import type { AppPorts } from "../core/application/ports";

/** Wires the ports for the current runtime. */
export async function createPorts(): Promise<AppPorts> {
  if (import.meta.env.VITE_ADAPTER === "memory") {
    const [{ createMemoryGateway }, { CachedDatasetRepository }, { withFaultInjection }] =
      await Promise.all([
        import("../adapters/memory/gateway"),
        import("../adapters/memory/cached"),
        import("../adapters/memory/fault-injection"),
      ]);
    const ports = await createMemoryGateway();
    return withFaultInjection({
      ...ports,
      dataset: new CachedDatasetRepository(ports.dataset),
    });
  }
  const [{ createTauriGateway }, { CachedDatasetRepository }] = await Promise.all([
    import("../adapters/tauri/gateway"),
    import("../adapters/memory/cached"),
  ]);
  const ports = createTauriGateway();
  return { ...ports, dataset: new CachedDatasetRepository(ports.dataset) };
}
