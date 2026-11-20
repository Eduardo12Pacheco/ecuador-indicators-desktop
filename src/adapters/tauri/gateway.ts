/**
 * Tauri gateway: the only module that invokes IPC commands (S24, S34).
 *
 * Every response is parsed with its zod contract before being mapped into the
 * branded domain model. The `invoke` function is injectable so the whole
 * gateway is unit-tested without a Tauri runtime.
 */

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { z } from "zod";
import { type AppPorts, type ExportRequest, SAVE_CANCELLED } from "../../core/application/ports";
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

/** Save dialog options used by the native adapter. */
export interface SaveDialogOptions {
  readonly defaultPath?: string;
  readonly filters?: readonly { readonly name: string; readonly extensions: readonly string[] }[];
}

/** Open dialog options used by the native adapter. */
export interface OpenDialogOptions {
  readonly multiple?: boolean;
  readonly directory?: boolean;
  readonly filters?: readonly { readonly name: string; readonly extensions: readonly string[] }[];
}

/** Native OS integrations, injectable so tests never touch a real dialog. */
export interface TauriNativeDeps {
  save(options: SaveDialogOptions): Promise<string | null>;
  open(options: OpenDialogOptions): Promise<string | null>;
  openUrl(url: string): Promise<void>;
}

const nativeDeps: TauriNativeDeps = {
  save: (options) => saveDialog(options as never) as Promise<string | null>,
  open: async (options) => {
    const chosen = await openDialog(options as never);
    return typeof chosen === "string" ? chosen : null;
  },
  openUrl: (url) => openUrl(url),
};

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
 * @param deps - native dialog/opener bindings; defaults to the plugins.
 */
export function createTauriGateway(
  invokeFn: InvokeFn = invoke,
  deps: TauriNativeDeps = nativeDeps,
): AppPorts {
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
      async save(request: ExportRequest) {
        const extension = request.kind;
        let path: string | null;
        try {
          path = await deps.save({
            defaultPath: request.suggestedName,
            filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
          });
        } catch (error) {
          return err(
            appError("EXPORT_REJECTED", "the save dialog could not be opened", String(error)),
          );
        }
        if (path === null) {
          return ok(SAVE_CANCELLED);
        }
        const content =
          typeof request.content === "string"
            ? Array.from(new TextEncoder().encode(request.content))
            : Array.from(request.content);
        return call("export_save", { path, content }, z.string());
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
    snapshotPicker: {
      async pickSnapshot() {
        try {
          const path = await deps.open({
            multiple: false,
            directory: false,
            filters: [{ name: "Snapshot", extensions: ["sqlite", "db"] }],
          });
          return ok(path);
        } catch (error) {
          return err(
            appError("INTERNAL", "the snapshot dialog could not be opened", String(error)),
          );
        }
      },
    },
    externalLinks: {
      async open(url: string) {
        let parsed: URL;
        try {
          parsed = new URL(url);
        } catch {
          return err(appError("INVALID_INPUT", `not a valid URL: ${url}`));
        }
        if (parsed.protocol !== "https:") {
          return err(appError("INVALID_INPUT", `only https links are opened, got ${parsed.href}`));
        }
        try {
          await deps.openUrl(url);
          return ok(undefined);
        } catch (error) {
          return err(appError("INTERNAL", "the system browser could not be opened", String(error)));
        }
      },
    },
  };
}
