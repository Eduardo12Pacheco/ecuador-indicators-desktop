/**
 * Fault-injection decorators for Playwright state tests (S12).
 *
 * The spec sets `localStorage['e2e:fault']` to `catalog`, `observations`,
 * `views` or `snapshot`; the matching reads fail until the key is cleared, so
 * the Retry and Dataset-problem paths can be exercised deterministically.
 */

import type { AppPorts, DatasetRepository, ViewRepository } from "../../core/application/ports";
import { appError } from "../../core/domain/errors";
import type { Catalog, NewView, Observation, SavedView } from "../../core/domain/model";
import { err, type Result } from "../../core/domain/result";

/** The selectable failure surface. */
export type FaultKind = "catalog" | "observations" | "views" | "snapshot";

/** The localStorage key read by the decorators. */
export const FAULT_KEY = "e2e:fault";

/** Minimal storage read surface. */
export interface FaultStorage {
  getItem(key: string): string | null;
}

function defaultStorage(): FaultStorage | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Reads the active fault, ignoring unknown values. */
export function readFault(storage: FaultStorage | null = defaultStorage()): FaultKind | null {
  if (storage === null) {
    return null;
  }
  const value = storage.getItem(FAULT_KEY);
  return value === "catalog" ||
    value === "observations" ||
    value === "views" ||
    value === "snapshot"
    ? value
    : null;
}

function storageError(kind: FaultKind) {
  return appError("STORAGE", `simulated ${kind} failure`, `fault injection: ${kind}`);
}

/** Wraps dataset reads with the injection check. */
export class FaultInjectingDatasetRepository implements DatasetRepository {
  constructor(
    private readonly inner: DatasetRepository,
    private readonly storage: FaultStorage | null = defaultStorage(),
  ) {}

  async getInfo() {
    return readFault(this.storage) === "snapshot"
      ? err(appError("SNAPSHOT_INVALID", "simulated snapshot failure", "fault injection: snapshot"))
      : this.inner.getInfo();
  }

  async getCatalog(): Promise<Result<Catalog>> {
    return readFault(this.storage) === "catalog"
      ? err(storageError("catalog"))
      : this.inner.getCatalog();
  }

  async getObservations(
    codes: readonly string[],
    iso3s: readonly string[],
  ): Promise<Result<readonly Observation[]>> {
    return readFault(this.storage) === "observations"
      ? err(storageError("observations"))
      : this.inner.getObservations(codes, iso3s);
  }

  async openSnapshot(path: string) {
    return this.inner.openSnapshot(path);
  }

  async resetSnapshot() {
    return this.inner.resetSnapshot();
  }
}

/** Wraps view reads with the injection check. */
export class FaultInjectingViewRepository implements ViewRepository {
  constructor(
    private readonly inner: ViewRepository,
    private readonly storage: FaultStorage | null = defaultStorage(),
  ) {}

  async list(): Promise<Result<readonly SavedView[]>> {
    return readFault(this.storage) === "views" ? err(storageError("views")) : this.inner.list();
  }

  async create(view: NewView) {
    return this.inner.create(view);
  }

  async update(id: string, view: NewView) {
    return this.inner.update(id, view);
  }

  async remove(id: string) {
    return this.inner.remove(id);
  }
}

/** Wraps every read port of a gateway with fault injection. */
export function withFaultInjection(
  ports: AppPorts,
  storage: FaultStorage | null = defaultStorage(),
): AppPorts {
  return {
    ...ports,
    dataset: new FaultInjectingDatasetRepository(ports.dataset, storage),
    views: new FaultInjectingViewRepository(ports.views, storage),
  };
}
