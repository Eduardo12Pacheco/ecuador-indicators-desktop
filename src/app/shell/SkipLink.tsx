import type { MouseEvent } from "react";

import { useT } from "../../ui/i18n/useT";
import styles from "./SkipLink.module.css";

/** The first focusable element; moves focus to the main landmark. */
export function SkipLink() {
  const { t } = useT();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    // The hash is the router location, so the link must not navigate.
    event.preventDefault();
    document.getElementById("main")?.focus();
  }

  return (
    // biome-ignore lint/a11y/useValidAnchor: a skip link is a navigation affordance; the router owns the hash, so the handler only moves focus.
    <a href="#main" className={styles.link} onClick={handleClick}>
      {t("shell.skipToContent")}
    </a>
  );
}
