import { afterEach, describe, expect, it, vi } from "vitest";
import { CachedDatasetRepository } from "../adapters/memory/cached";
import { createPorts } from "./bootstrap";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createPorts", () => {
  it("wires the in-memory adapter when VITE_ADAPTER=memory", async () => {
    vi.stubEnv("VITE_ADAPTER", "memory");
    const ports = await createPorts();
    const catalog = await ports.dataset.getCatalog();
    expect(catalog.ok && catalog.value.indicators.length).toBe(6);
    expect((await ports.settings.get()).ok).toBe(true);
  });

  it("wires the Tauri adapter otherwise", async () => {
    vi.stubEnv("VITE_ADAPTER", "tauri");
    const ports = await createPorts();
    expect(ports.dataset).toBeInstanceOf(CachedDatasetRepository);
    expect(ports.settings).toBeDefined();
    expect(ports.export).toBeDefined();
  });

  it("defaults to the Tauri adapter when unset", async () => {
    vi.stubEnv("VITE_ADAPTER", "");
    const ports = await createPorts();
    expect(ports.dataset).toBeInstanceOf(CachedDatasetRepository);
  });
});
