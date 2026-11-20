/**
 * View models returned by the use cases to the UI.
 */

import type { ChartKind, Geography, Indicator, Series, Transform, Year } from "../../domain/model";

/** Everything the Explore page needs for one render. */
export interface ExploreModel {
  readonly indicator: Indicator;
  readonly geographies: readonly Geography[];
  /** One series per requested geography, already transformed and clipped. */
  readonly series: readonly Series[];
  readonly transform: Transform;
  readonly baseYear: Year | null;
  readonly from: Year | null;
  readonly to: Year | null;
  readonly chart: ChartKind;
}

/** Everything the Compare trajectories tab needs. */
export interface TrajectoriesModel {
  readonly indicators: readonly Indicator[];
  readonly geography: Geography;
  readonly baseYear: Year | null;
  readonly series: readonly Series[];
}

/** One ranked row with its geography metadata. */
export interface RankingRow {
  readonly geography: Geography;
  readonly value: number;
}

/** Everything the Compare ranking tab needs. */
export interface RankingModel {
  readonly indicator: Indicator;
  readonly year: Year;
  readonly ranked: readonly RankingRow[];
  readonly missing: readonly Geography[];
}
