import { useT } from "../../../i18n/useT";
import styles from "./Spinner.module.css";

/** An indeterminate progress indicator with a status role. */
export function Spinner({
  label,
  size = "md",
}: {
  readonly label?: string;
  readonly size?: "md" | "sm";
}) {
  const { t } = useT();
  const accessibleLabel = label ?? t("primitive.spinner");
  return (
    <span
      role="status"
      aria-label={accessibleLabel}
      className={[styles.spinner, styles[size]].join(" ")}
    />
  );
}
