/** Settings use cases. The document is already typed and validated upstream. */

import type { Settings } from "../../domain/model";
import type { Result } from "../../domain/result";
import type { SettingsRepository } from "../ports";

/** Returns the complete settings document (defaults when absent). */
export async function getSettings(settings: SettingsRepository): Promise<Result<Settings>> {
  return settings.get();
}

/** Persists the complete settings document. */
export async function updateSettings(
  settings: SettingsRepository,
  document: Settings,
): Promise<Result<void>> {
  return settings.set(document);
}
