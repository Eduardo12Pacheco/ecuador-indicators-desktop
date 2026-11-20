/**
 * Ports fake for shell and component tests. Excluded from coverage.
 */

import type { AppPorts, ExportRequest } from "../core/application/ports";
import { ok, type Result } from "../core/domain/result";
import { makeAppInfo, makeCatalog, makeDatasetInfo, makeSettings } from "./factories";

function resolved<T>(value: T): Promise<Result<T>> {
  return Promise.resolve(ok(value));
}

/** Builds every port with deterministic defaults; override per test. */
export function createFakePorts(overrides: Partial<AppPorts> = {}): AppPorts {
  const defaults: AppPorts = {
    dataset: {
      getInfo: () => resolved(makeDatasetInfo()),
      getCatalog: () => resolved(makeCatalog()),
      getObservations: () => resolved([]),
      openSnapshot: () => resolved(makeDatasetInfo()),
      resetSnapshot: () => resolved(makeDatasetInfo()),
    },
    views: {
      list: () => resolved([]),
      create: () =>
        resolved({
          id: "view-1",
          name: "view",
          spec: { kind: "ranking", indicator: "NY.GDP.MKTP.CD" as never, year: 2020 as never },
          createdAt: 1,
          updatedAt: 1,
        }),
      update: () =>
        resolved({
          id: "view-1",
          name: "view",
          spec: { kind: "ranking", indicator: "NY.GDP.MKTP.CD" as never, year: 2020 as never },
          createdAt: 1,
          updatedAt: 1,
        }),
      remove: () => resolved(undefined),
    },
    settings: {
      get: () => resolved(makeSettings()),
      set: () => resolved(undefined),
    },
    export: {
      save: (_request: ExportRequest) => resolved("/tmp/export.csv"),
    },
    updates: {
      check: () => resolved({ kind: "disabled", current: "0.1.0" }),
    },
    appInfo: {
      get: () => resolved(makeAppInfo()),
    },
  };
  return { ...defaults, ...overrides };
}
