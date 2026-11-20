/**
 * Saved-view use cases. Validation is mirrored from the authoritative Rust
 * `ViewService` (D25) so the in-memory adapter gives the same feedback.
 */

import type { NewView, SavedView } from "../../domain/model";
import { ok, type Result } from "../../domain/result";
import { validateViewName, validateViewSpec } from "../../domain/view";
import type { ViewRepository } from "../ports";

function validate(view: NewView): Result<void> {
  const name = validateViewName(view.name);
  if (!name.ok) {
    return name;
  }
  return validateViewSpec(view.spec);
}

/** Lists saved views, most recently updated first (adapter order). */
export async function listViews(views: ViewRepository): Promise<Result<readonly SavedView[]>> {
  return views.list();
}

/** Validates and creates a saved view. */
export async function createView(views: ViewRepository, view: NewView): Promise<Result<SavedView>> {
  const validity = validate(view);
  if (!validity.ok) {
    return validity;
  }
  return views.create({ ...view, name: view.name.trim() });
}

/** Validates and updates a saved view. */
export async function updateView(
  views: ViewRepository,
  id: string,
  view: NewView,
): Promise<Result<SavedView>> {
  const validity = validate(view);
  if (!validity.ok) {
    return validity;
  }
  return views.update(id, { ...view, name: view.name.trim() });
}

/** Deletes a saved view. */
export async function deleteView(views: ViewRepository, id: string): Promise<Result<void>> {
  if (id.trim() === "") {
    return { ok: false, error: { code: "VIEW_NOT_FOUND", message: "a view id is required" } };
  }
  const result = await views.remove(id);
  return result.ok ? ok(undefined) : result;
}
