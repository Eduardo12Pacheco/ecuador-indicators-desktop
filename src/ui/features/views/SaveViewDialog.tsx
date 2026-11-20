/**
 * Create, update or duplicate a saved view (S6).
 *
 * The dialog validates locally for fast feedback, but the repository remains
 * authoritative: `VIEW_INVALID` and `LIMIT_EXCEEDED` are mapped back to the
 * same translated messages.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { createView, updateView } from "../../../core/application/use-cases/views";
import type { AppError } from "../../../core/domain/errors";
import type { SavedView, ViewSpec } from "../../../core/domain/model";
import { MAX_VIEWS, validateViewName } from "../../../core/domain/view";
import { Button } from "../../design/primitives/Button/Button";
import { Dialog } from "../../design/primitives/Dialog/Dialog";
import { useToast } from "../../design/primitives/Toast/Toast";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import styles from "./SaveViewDialog.module.css";
import { defaultViewName } from "./view-summary";

/** Props of {@link SaveViewDialog}. */
export interface SaveViewDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly spec: ViewSpec | null;
  /** The stored view to update; omit to create a new one. */
  readonly existing?: SavedView | null;
  /** Hide the "Save as new" action (rename mode). */
  readonly allowSaveAsNew?: boolean;
}

/** Modal used by `Mod+S` and by the Saved views page. */
export function SaveViewDialog({
  open,
  onOpenChange,
  spec,
  existing = null,
  allowSaveAsNew = true,
}: SaveViewDialogProps) {
  const ports = usePorts();
  const { t, lang } = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const catalogQuery = useQuery({
    queryKey: ["dataset", "catalog"],
    queryFn: () => ports.dataset.getCatalog(),
    enabled: open,
  });
  const viewsQuery = useQuery({
    queryKey: ["views", "list"],
    queryFn: () => ports.views.list(),
    enabled: open,
  });
  const catalog = catalogQuery.data?.ok === true ? catalogQuery.data.value : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setName(existing?.name ?? "");
  }, [open, existing]);

  useEffect(() => {
    if (!open || catalog === null || spec === null) {
      return;
    }
    setName((current) => (current.trim() === "" ? defaultViewName(spec, catalog, lang) : current));
  }, [catalog, lang, open, spec]);

  const viewCount = viewsQuery.data?.ok === true ? viewsQuery.data.value.length : 0;

  function messageFor(failure: AppError): string {
    switch (failure.code) {
      case "VIEW_INVALID":
        return t("saveView.invalidName");
      case "LIMIT_EXCEEDED":
        return t("saveView.limit");
      default:
        return `${t("saveView.error")} ${failure.message}`;
    }
  }

  async function save(createNew: boolean): Promise<void> {
    if (spec === null || saving) {
      return;
    }
    if (!validateViewName(name).ok) {
      setError(t("saveView.invalidName"));
      return;
    }
    const updating = existing !== null && !createNew;
    if (!updating && viewCount >= MAX_VIEWS) {
      setError(t("saveView.limit"));
      return;
    }
    setSaving(true);
    setError(null);
    const payload = { name: name.trim(), spec };
    const result = updating
      ? await updateView(ports.views, existing.id, payload)
      : await createView(ports.views, payload);
    setSaving(false);
    if (!result.ok) {
      setError(messageFor(result.error));
      return;
    }
    showToast({
      title: updating
        ? t("saveView.updated", { name: result.value.name })
        : t("saveView.saved", { name: result.value.name }),
      variant: "success",
    });
    await queryClient.invalidateQueries({ queryKey: ["views"] });
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("saveView.title")}
      description={t("saveView.description")}
    >
      <form
        className={styles.form}
        data-testid="save-view-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void save(false);
        }}
      >
        <label className={styles.label} htmlFor="save-view-name">
          {t("saveView.nameLabel")}
        </label>
        <input
          id="save-view-name"
          data-testid="save-view-name"
          className={styles.input}
          value={name}
          maxLength={80}
          placeholder={t("saveView.namePlaceholder")}
          onChange={(event) => setName(event.target.value)}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? undefined : "save-view-error"}
        />
        {error === null ? null : (
          <p id="save-view-error" className={styles.error} role="alert">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {existing !== null && allowSaveAsNew ? (
            <Button variant="secondary" loading={saving} onClick={() => void save(true)}>
              {t("saveView.saveAsNew")}
            </Button>
          ) : null}
          <Button variant="primary" type="submit" loading={saving}>
            {existing === null ? t("saveView.save") : t("saveView.update", { name: existing.name })}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
