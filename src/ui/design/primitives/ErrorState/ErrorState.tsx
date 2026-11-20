import { useT } from "../../../i18n/useT";
import { Button } from "../Button/Button";
import styles from "./ErrorState.module.css";

/** An error surface with a details disclosure and a retry action. */
export function ErrorState({
  title,
  message,
  details,
  onRetry,
}: {
  readonly title?: string;
  readonly message: string;
  readonly details?: string;
  readonly onRetry?: () => void;
}) {
  const { t } = useT();
  return (
    <div className={styles.error} role="alert">
      <h3 className={styles.title}>{title ?? t("state.error.title")}</h3>
      <p className={styles.message}>{message}</p>
      {details ? (
        <details className={styles.details}>
          <summary>{t("common.details")}</summary>
          <pre>{details}</pre>
        </details>
      ) : null}
      {onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
