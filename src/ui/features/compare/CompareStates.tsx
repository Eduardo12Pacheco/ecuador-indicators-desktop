import { Button } from "../../design/primitives/Button/Button";
import { EmptyState } from "../../design/primitives/EmptyState/EmptyState";
import { ErrorState } from "../../design/primitives/ErrorState/ErrorState";
import { Skeleton } from "../../design/primitives/Skeleton/Skeleton";
import { useT } from "../../i18n/useT";
import styles from "./CompareStates.module.css";

/** Loading skeleton for either compare tab. */
export function CompareSkeleton() {
  const { t } = useT();
  return (
    <div className={styles.skeleton} aria-busy="true">
      <div className={styles.controls}>
        <Skeleton height={54} />
        <Skeleton height={54} />
      </div>
      <Skeleton height={320} />
      <p className={styles.loadingText}>{t("compare.states.loading")}</p>
    </div>
  );
}

/** Empty compare state with a recovery action. */
export function CompareEmpty({
  title,
  description,
  actionLabel,
  onAction,
}: {
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
}) {
  return (
    <EmptyState
      title={title}
      description={description}
      action={
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      }
    />
  );
}

/** Error surface with Retry for compare queries. */
export function CompareError({
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
