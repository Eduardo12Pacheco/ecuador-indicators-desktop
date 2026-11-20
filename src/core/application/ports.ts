/**
 * Secondary ports implemented by adapters (Tauri IPC or in-memory browsers).
 *
 * Use cases depend only on these interfaces, never on an adapter module.
 */

import type {
  AppInfo,
  Catalog,
  DatasetInfo,
  NewView,
  Observation,
  SavedView,
  Settings,
  UpdateStatus,
} from "../domain/model";
import type { Result } from "../domain/result";

/** Read side of the active snapshot. */
export interface DatasetRepository {
  getInfo(): Promise<Result<DatasetInfo>>;
  getCatalog(): Promise<Result<Catalog>>;
  getObservations(
    codes: readonly string[],
    iso3s: readonly string[],
  ): Promise<Result<readonly Observation[]>>;
  openSnapshot(path: string): Promise<Result<DatasetInfo>>;
  resetSnapshot(): Promise<Result<DatasetInfo>>;
}

/** Persisted views. */
export interface ViewRepository {
  list(): Promise<Result<readonly SavedView[]>>;
  create(view: NewView): Promise<Result<SavedView>>;
  update(id: string, view: NewView): Promise<Result<SavedView>>;
  remove(id: string): Promise<Result<void>>;
}

/** Persisted settings. */
export interface SettingsRepository {
  get(): Promise<Result<Settings>>;
  set(settings: Settings): Promise<Result<void>>;
}

/** An exportable file kind. */
export type ExportKind = "csv" | "png";

/** A file ready to be saved by the host. */
export interface ExportRequest {
  readonly suggestedName: string;
  readonly kind: ExportKind;
  readonly content: string | Uint8Array;
}

/** Marker returned by adapters when the user cancels the native save dialog. */
export const SAVE_CANCELLED = "cancelled";

/** Marker returned by the browser adapter after starting a download. */
export const DOWNLOAD_STARTED = "download";

/** Native save boundary. Returns the saved path or a download marker. */
export interface ExportGateway {
  save(request: ExportRequest): Promise<Result<string>>;
}

/** Native file picker used by the custom-snapshot setting (S14). */
export interface SnapshotPicker {
  /** Returns the chosen path, or `null` when the user cancels. */
  pickSnapshot(): Promise<Result<string | null>>;
}

/** Opens external URLs in the system browser (S13, S32). */
export interface ExternalLinkGateway {
  open(url: string): Promise<Result<void>>;
}

/** Opt-in update check. */
export interface UpdateGateway {
  check(force: boolean): Promise<Result<UpdateStatus>>;
}

/** Read-only application metadata. */
export interface AppInfoGateway {
  get(): Promise<Result<AppInfo>>;
}

/** Every port the composition root wires together. */
export interface AppPorts {
  readonly dataset: DatasetRepository;
  readonly views: ViewRepository;
  readonly settings: SettingsRepository;
  readonly export: ExportGateway;
  readonly updates: UpdateGateway;
  readonly appInfo: AppInfoGateway;
  readonly snapshotPicker: SnapshotPicker;
  readonly externalLinks: ExternalLinkGateway;
}
