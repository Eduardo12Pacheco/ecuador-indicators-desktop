import { Button } from "../../design/primitives/Button/Button";
import { EmptyState } from "../../design/primitives/EmptyState/EmptyState";
import { ErrorState } from "../../design/primitives/ErrorState/ErrorState";
import { Skeleton } from "../../design/primitives/Skeleton/Skeleton";
import { useT } from "../../i18n/useT";
import styles from "./ExploreStates.module.css";

/** Loading skeleton matching the KPI and chart layout. */
export function ExploreSkeleton() {
  const { t } = useT();
  return (
    <div className={styles.skeleton} aria-busy="true">
      <Skeleton height={28} width="45%" />
      <div className={styles.cards}>
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} height={92} />
        ))}
      </div>
      <Skeleton height={320} />
      <p className={styles.loadingText}>{t("explore.loading")}</p>
    </div>
  );
}

/** Empty selection with a recovery action that widens or resets the query. */
export function ExploreEmpty({
  onRemovePeers,
  onReset,
}: {
  readonly onRemovePeers?: () => void;
  readonly onReset: () => void;
}) {
  const { t } = useT();
  return (
    <EmptyState
      title={t("explore.empty.title")}
      description={t("explore.empty.description")}
      action={
        <div className={styles.actions}>
          {onRemovePeers ? (
            <Button variant="primary" onClick={onRemovePeers}>
              {t("explore.empty.removePeers")}
            </Button>
          ) : null}
          <Button variant={onRemovePeers ? "ghost" : "primary"} onClick={onReset}>
            {t("explore.empty.reset")}
          </Button>
        </div>
      }
    />
  );
}

/** Error surface with Retry. */
export function ExploreError({
  message,
  details,
  onRetry,
}: {
  readonly message: string;
  readonly details?: string;
  readonly onRetry: () => void;
}) {
  return (
    <ErrorState
      message={message}
      {...(details === undefined ? {} : { details })}
      onRetry={onRetry}
    />
  );
}
