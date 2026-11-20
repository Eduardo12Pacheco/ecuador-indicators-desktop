import { LanguageSwitch } from "./LanguageSwitch";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./TopBar.module.css";

/** Top bar: the banner landmark and global appearance controls. */
export function TopBar() {
  return (
    <header className={styles.topbar}>
      <div className={styles.spacer} />
      <div className={styles.controls}>
        <LanguageSwitch />
        <ThemeToggle />
      </div>
    </header>
  );
}
