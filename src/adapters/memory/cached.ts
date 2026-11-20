/**
 * Decorator that memoizes catalog and observation reads for the lifetime of the
 * active snapshot. Opening or resetting a snapshot invalidates the cache.
 */

import type { DatasetRepository } from "../../core/application/ports";
import type { Catalog, DatasetInfo, Observation } from "../../core/domain/model";
import { ok, type Result } from "../../core/domain/result";

function cacheKey(codes: readonly string[], iso3s: readonly string[]): string {
  return `${[...codes].sort().join(",")}|${[...iso3s].sort().join(",")}`;
}

/** Caches immutable snapshot reads. */
export class CachedDatasetRepository implements DatasetRepository {
  private catalog: Catalog | null = null;
  private readonly observations = new Map<string, readonly Observation[]>();

  constructor(private readonly inner: DatasetRepository) {}

  async getInfo(): Promise<Result<DatasetInfo>> {
    return this.inner.getInfo();
  }

  async getCatalog(): Promise<Result<Catalog>> {
    if (this.catalog !== null) {
      return ok(this.catalog);
    }
    const result = await this.inner.getCatalog();
    if (result.ok) {
      this.catalog = result.value;
    }
    return result;
  }

  async getObservations(
    codes: readonly string[],
    iso3s: readonly string[],
  ): Promise<Result<readonly Observation[]>> {
    const key = cacheKey(codes, iso3s);
    const cached = this.observations.get(key);
    if (cached !== undefined) {
      return ok(cached);
    }
    const result = await this.inner.getObservations(codes, iso3s);
    if (result.ok) {
      this.observations.set(key, result.value);
    }
    return result;
  }

  async openSnapshot(path: string): Promise<Result<DatasetInfo>> {
    const result = await this.inner.openSnapshot(path);
    if (result.ok) {
      this.invalidate();
    }
    return result;
  }

  async resetSnapshot(): Promise<Result<DatasetInfo>> {
    const result = await this.inner.resetSnapshot();
    if (result.ok) {
      this.invalidate();
    }
    return result;
  }

  /** Drops every cached read; exposed for tests and future explicit refreshes. */
  invalidate(): void {
    this.catalog = null;
    this.observations.clear();
  }
}
