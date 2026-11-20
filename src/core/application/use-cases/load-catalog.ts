/** Loads the catalog for the Explore, Compare and About pages. */

import type { Catalog } from "../../domain/model";
import type { Result } from "../../domain/result";
import type { DatasetRepository } from "../ports";

/** Returns the complete curated catalog. */
export async function loadCatalog(dataset: DatasetRepository): Promise<Result<Catalog>> {
  return dataset.getCatalog();
}
