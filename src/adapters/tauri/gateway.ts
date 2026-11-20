/**
 * Tauri gateway: the only module that invokes IPC commands (S24, S34).
 *
 * Every response is parsed with its zod contract before being mapped into the
 * branded domain model. The `invoke` function is injectable so the whole
 * gateway is unit-tested without a Tauri runtime.
 */

import { invoke } from "@tauri-apps/api/core";
import type { z } from "zod";
import type { AppPorts, ExportRequest } from "../../core/application/ports";
import {
  appInfoSchema,
  catalogSchema,
  datasetInfoSchema,
  ipcSchemas,
  settingsSchema,
  updateStatusSchema,
} from "../../core/contracts/ipc";
import { type AppError, appError, isAppError, isAppErrorCode } from "../../core/domain/errors";
import type { NewView, Settings } from "../../core/domain/model";
import { err, ok, type Result } from "../../core/domain/result";
import {
  mapAppInfo,
  mapCatalog,
  mapDatasetInfo,
  mapObservation,
  mapSavedView,
  mapSettings,
  mapUpdateStatus,
  newViewToWire,
  settingsToWire,
} from "./mappers";

/** The minimal invoke surface, injectable for tests. */
export type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Maps unknown thrown values from `invoke` to the typed error model. */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const candidate = error as { code?: unknown; message?: unknown };
    if (typeof candidate.code === "string" && typeof candidate.message === "string") {
      return appError(
        isAppErrorCode(candidate.code) ? candidate.code : "INTERNAL",
        candidate.message,
      );
    }
  }
  if (error instanceof Error) {
    return appError("INTERNAL", error.message);
  }
  return appError("INTERNAL", String(error));
}

/**
 * Creates the Tauri-backed ports.
 *
 * @param invokeFn - the IPC function; defaults to Tauri's `invoke`.
 */
export function createTauriGateway(invokeFn: InvokeFn = invoke): AppPorts {
  async function call<T>(
    command: string,
    args: Record<string, unknown> | undefined,
    schema: z.ZodType<T>,
  ): Promise<Result<T>> {
    try {
      const raw = await invokeFn(command, args);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return err(
          appError(
            "INTERNAL",
            `invalid payload from ${command}`,
            parsed.error.issues.map((issue) => issue.message).join("; "),
          ),
        );
      }
      return ok(parsed.data);
    } catch (error) {
      return err(toAppError(error));
    }
  }

  return {
    dataset: {
      async getInfo() {
        const result = await call("dataset_info", undefined, datasetInfoSchema);
        return result.ok ? ok(mapDatasetInfo(result.value)) : result;
      },
      async getCatalog() {
        const result = await call("dataset_catalog", undefined, catalogSchema);
        return result.ok ? ok(mapCatalog(result.value)) : result;
      },
      async getObservations(codes, iso3s) {
        const result = await call(
          "dataset_observations",
          { codes: [...codes], iso3s: [...iso3s] },
          ipcSchemas.dataset_observations,
        );
        return result.ok ? ok(result.value.map(mapObservation)) : result;
      },
      async openSnapshot(path) {
        const result = await call(
          "dataset_open_snapshot",
          { path },
          ipcSchemas.dataset_open_snapshot,
        );
        return result.ok ? ok(mapDatasetInfo(result.value)) : result;
      },
      async resetSnapshot() {
        const result = await call(
          "dataset_reset_snapshot",
          undefined,
          ipcSchemas.dataset_reset_snapshot,
        );
        return result.ok ? ok(mapDatasetInfo(result.value)) : result;
      },
    },
    views: {
      async list() {
        const result = await call("views_list", undefined, ipcSchemas.views_list);
        return result.ok ? ok(result.value.map(mapSavedView)) : result;
      },
      async create(view: NewView) {
        const result = await call(
          "views_create",
          { view: newViewToWire(view) },
          ipcSchemas.views_create,
        );
        return result.ok ? ok(mapSavedView(result.value)) : result;
      },
      async update(id: string, view: NewView) {
        const result = await call(
          "views_update",
          { id, view: newViewToWire(view) },
          ipcSchemas.views_update,
        );
        return result.ok ? ok(mapSavedView(result.value)) : result;
      },
      async remove(id: string) {
        const result = await call("views_delete", { id }, ipcSchemas.views_delete);
        return result.ok ? ok(undefined) : result;
      },
    },
    settings: {
      async get() {
        const result = await call("settings_get", undefined, settingsSchema);
        return result.ok ? ok(mapSettings(result.value)) : result;
      },
      async set(document: Settings) {
        const result = await call(
          "settings_set",
          { settings: settingsToWire(document) },
          ipcSchemas.settings_set,
        );
        return result.ok ? ok(undefined) : result;
      },
    },
    export: {
      async save(_request: ExportRequest) {
        // The native save dialog is wired in T10; the Rust command already
        // validates extensions and writes atomically.
        return err(
          appError(
            "INVALID_INPUT",
            "the native save dialog is not available yet",
            "export saving is completed in the export task",
          ),
        );
      },
    },
    updates: {
      async check(force: boolean) {
        const result = await call("updates_check", { force }, updateStatusSchema);
        return result.ok ? ok(mapUpdateStatus(result.value)) : result;
      },
    },
    appInfo: {
      async get() {
        const result = await call("app_info", undefined, appInfoSchema);
        return result.ok ? ok(mapAppInfo(result.value)) : result;
      },
    },
  };
}
