import type { ReactNode } from "react";

import styles from "./VisuallyHidden.module.css";

/** Keeps content in the accessibility tree while hiding it visually. */
export function VisuallyHidden({ children }: { readonly children: ReactNode }) {
  return <span className={styles.hidden}>{children}</span>;
}
