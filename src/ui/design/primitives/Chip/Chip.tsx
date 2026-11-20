import type { ReactNode } from "react";

import { useT } from "../../../i18n/useT";
import styles from "./Chip.module.css";

/** A compact label, optionally removable. */
export function Chip({
  children,
  label,
  onRemove,
}: {
  readonly children: ReactNode;
  readonly label?: string;
  readonly onRemove?: () => void;
}) {
  const { t } = useT();
  const name = label ?? (typeof children === "string" ? children : "");
  return (
    <span className={styles.chip}>
      {children}
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          aria-label={t("primitive.chip.remove", { label: name })}
          onClick={onRemove}
        >
          <span aria-hidden="true">×</span>
        </button>
      ) : null}
    </span>
  );
}
