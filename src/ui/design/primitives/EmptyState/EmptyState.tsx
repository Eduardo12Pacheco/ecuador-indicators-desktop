import type { ReactNode } from "react";

import styles from "./EmptyState.module.css";

/** A first-run or filtered-empty state with an optional recovery action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
  readonly icon?: ReactNode;
}) {
  return (
    <div className={styles.empty}>
      {icon ? <div className={styles.icon}>{icon}</div> : null}
      <h3 className={styles.title}>{title}</h3>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action}
    </div>
  );
}
