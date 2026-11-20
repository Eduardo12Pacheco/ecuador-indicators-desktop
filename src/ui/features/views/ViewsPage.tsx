/**
 * Saved views page (S6): list, open, rename and delete persisted page states.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { deleteView, listViews } from "../../../core/application/use-cases/views";
import {
  geographyName,
  indicatorName,
  type Lang,
  type SavedView,
} from "../../../core/domain/model";
import { Button } from "../../design/primitives/Button/Button";
import { Card } from "../../design/primitives/Card/Card";
import { Chip } from "../../design/primitives/Chip/Chip";
import { Dialog } from "../../design/primitives/Dialog/Dialog";
import { EmptyState } from "../../design/primitives/EmptyState/EmptyState";
import { ErrorState } from "../../design/primitives/ErrorState/ErrorState";
import { Skeleton } from "../../design/primitives/Skeleton/Skeleton";
import { useToast } from "../../design/primitives/Toast/Toast";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import { SaveViewDialog } from "./SaveViewDialog";
import styles from "./ViewsPage.module.css";
import { viewSpecToLocation } from "./view-location";
import { describeViewSpec, viewKindKey } from "./view-summary";

function formatUpdated(updatedAt: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
    new Date(updatedAt * 1000),
  );
}

function locationFor(view: SavedView): string {
  const location = viewSpecToLocation(view.spec);
  const [pathname, search = ""] = location.split("?");
  const params = new URLSearchParams(search);
  params.set("view", view.id);
  return `${pathname}?${params.toString()}`;
}

/** Lists saved views with open, rename and delete actions. */
export function ViewsPage() {
  const ports = usePorts();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, tp, lang, locale } = useT();
  const { showToast } = useToast();
  const [renaming, setRenaming] = useState<SavedView | null>(null);
  const [deleting, setDeleting] = useState<SavedView | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  const viewsQuery = useQuery({
    queryKey: ["views", "list"],
    queryFn: () => listViews(ports.views),
  });
  const catalogQuery = useQuery({
    queryKey: ["dataset", "catalog"],
    queryFn: () => ports.dataset.getCatalog(),
  });

  const viewsResult = viewsQuery.data;
  const catalog = catalogQuery.data?.ok === true ? catalogQuery.data.value : null;

  function describe(view: SavedView): string {
    return catalog === null ? view.spec.kind : describeViewSpec(view.spec, catalog, lang as Lang);
  }

  async function remove(view: SavedView): Promise<void> {
    setDeletingBusy(true);
    setDeleteError(null);
    const result = await deleteView(ports.views, view.id);
    setDeletingBusy(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    showToast({ title: t("views.deleteConfirm"), description: view.name, variant: "success" });
    setDeleting(null);
    await queryClient.invalidateQueries({ queryKey: ["views"] });
  }

  if (viewsQuery.isPending) {
    return (
      <section className={styles.page} aria-labelledby="views-title">
        <h1 id="views-title">{t("page.views.title")}</h1>
        <p role="status">{t("views.loading")}</p>
        <Skeleton height={160} />
      </section>
    );
  }

  if (viewsResult !== undefined && !viewsResult.ok) {
    return (
      <section className={styles.page} aria-labelledby="views-title">
        <h1 id="views-title">{t("page.views.title")}</h1>
        <ErrorState
          message={viewsResult.error.message}
          details={`${viewsResult.error.code}: ${viewsResult.error.message}`}
          onRetry={() => {
            void viewsQuery.refetch();
          }}
        />
      </section>
    );
  }

  const views = viewsResult?.ok === true ? viewsResult.value : [];

  return (
    <section className={styles.page} aria-labelledby="views-title">
      <header className={styles.header}>
        <div>
          <h1 id="views-title">{t("page.views.title")}</h1>
          <p className={styles.description}>{t("page.views.description")}</p>
        </div>
        {views.length === 0 ? null : (
          <p className={styles.count} aria-live="polite">
            {tp("views.count", views.length)}
          </p>
        )}
      </header>

      {views.length === 0 ? (
        <EmptyState
          title={t("views.empty.title")}
          description={t("views.empty.description")}
          action={
            <Button variant="primary" onClick={() => navigate("/explore")}>
              {t("views.empty.action")}
            </Button>
          }
        />
      ) : (
        <ul className={styles.list} data-testid="views-list">
          {views.map((view) => (
            <li key={view.id} data-testid="view-card">
              <Card>
                <article className={styles.card}>
                  <header className={styles.cardHeader}>
                    <h2 className={styles.name}>{view.name}</h2>
                    <Chip>{t(viewKindKey(view))}</Chip>
                  </header>
                  <p className={styles.summary}>{describe(view)}</p>
                  <p className={styles.updated}>
                    {t("views.updated", { date: formatUpdated(view.updatedAt, locale) })}
                  </p>
                  <div className={styles.actions}>
                    <Button variant="primary" size="sm" onClick={() => navigate(locationFor(view))}>
                      {t("views.open")}
                    </Button>
                    <Button size="sm" onClick={() => setRenaming(view)}>
                      {t("views.rename")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(view);
                      }}
                    >
                      {t("views.delete")}
                    </Button>
                  </div>
                </article>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <SaveViewDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        spec={renaming?.spec ?? null}
        existing={renaming}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t("views.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("views.deleteDescription")}
      >
        <div className={styles.dialogActions}>
          {deleteError === null ? null : (
            <p className={styles.error} role="alert">
              {deleteError}
            </p>
          )}
          <Button variant="ghost" onClick={() => setDeleting(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            loading={deletingBusy}
            onClick={() => {
              if (deleting !== null) void remove(deleting);
            }}
          >
            {t("views.deleteConfirm")}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}

/** Kept for localized geography names in future card variants. */
export type { SavedView };

void geographyName;
void indicatorName;
