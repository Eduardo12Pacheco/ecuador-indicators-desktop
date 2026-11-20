/** Notify-only update check (S13): the adapter applies opt-in and throttling. */

import type { UpdateStatus } from "../../domain/model";
import type { Result } from "../../domain/result";
import type { UpdateGateway } from "../ports";

/** Runs an update check; `force` is the "Check now" button. */
export async function checkForUpdates(
  updates: UpdateGateway,
  force: boolean,
): Promise<Result<UpdateStatus>> {
  return updates.check(force);
}
