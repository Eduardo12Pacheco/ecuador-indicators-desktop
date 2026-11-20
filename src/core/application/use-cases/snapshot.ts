/** Custom snapshot use cases (S14). */

import type { DatasetInfo } from "../../domain/model";
import type { Result } from "../../domain/result";
import type { DatasetRepository } from "../ports";

/** Opens a pipeline-produced snapshot after adapter/core validation. */
export async function openSnapshot(
  dataset: DatasetRepository,
  path: string,
): Promise<Result<DatasetInfo>> {
  if (path.trim() === "") {
    return { ok: false, error: { code: "INVALID_INPUT", message: "a snapshot path is required" } };
  }
  return dataset.openSnapshot(path);
}

/** Restores the bundled snapshot. */
export async function resetSnapshot(dataset: DatasetRepository): Promise<Result<DatasetInfo>> {
  return dataset.resetSnapshot();
}
