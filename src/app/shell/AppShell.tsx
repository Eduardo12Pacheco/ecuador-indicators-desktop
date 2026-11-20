import { useState } from "react";
import { Outlet } from "react-router";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";
import { useNarrowViewport } from "./use-narrow-viewport";

/** Landmark skeleton: skip link, navigation, banner, main and status bar. */
export function AppShell() {
  const narrow = useNarrowViewport();
  const [manualCollapse, setManualCollapse] = useState<boolean | null>(null);
  const collapsed = manualCollapse ?? narrow;

  return (
    <div className={styles.app}>
      <SkipLink />
      <Sidebar collapsed={collapsed} onToggle={() => setManualCollapse(!collapsed)} />
      <div className={styles.body}>
        <TopBar />
        <main id="main" className={styles.main} tabIndex={-1}>
          <Outlet />
        </main>
        <StatusBar />
      </div>
    </div>
  );
}
