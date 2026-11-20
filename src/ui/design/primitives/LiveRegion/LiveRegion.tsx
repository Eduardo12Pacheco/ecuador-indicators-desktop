import type { ReactNode } from "react";

import styles from "./LiveRegion.module.css";

/** A polite (default) or assertive screen-reader announcement region. */
export function LiveRegion({
  children,
  assertive = false,
}: {
  readonly children: ReactNode;
  readonly assertive?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live={assertive ? "assertive" : "polite"}
      aria-atomic="true"
      className={styles.region}
    >
      {children}
    </div>
  );
}
