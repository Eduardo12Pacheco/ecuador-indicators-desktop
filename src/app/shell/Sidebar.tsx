import {
  Bookmark,
  Compass,
  GitCompare,
  Info,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";
import { NavLink } from "react-router";
import { IconButton } from "../../ui/design/primitives/IconButton/IconButton";
import type { MessageKey } from "../../ui/i18n/i18n";
import { useT } from "../../ui/i18n/useT";
import { APP_NAME } from "../meta";
import styles from "./Sidebar.module.css";

interface NavItem {
  readonly to: string;
  readonly titleKey: MessageKey;
  readonly icon: typeof Compass;
  readonly designOnly?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: "/explore", titleKey: "nav.explore", icon: Compass },
  { to: "/compare", titleKey: "nav.compare", icon: GitCompare },
  { to: "/views", titleKey: "nav.views", icon: Bookmark },
  { to: "/settings", titleKey: "nav.settings", icon: Settings },
  { to: "/about", titleKey: "nav.about", icon: Info },
  { to: "/design", titleKey: "nav.design", icon: Palette, designOnly: true },
];

/** Primary navigation with a wordmark and a deliberate collapse behaviour. */
export function Sidebar({
  collapsed,
  onToggle,
}: {
  readonly collapsed: boolean;
  readonly onToggle: () => void;
}) {
  const { t } = useT();
  const showDesign = import.meta.env.MODE !== "production";

  return (
    <aside className={styles.sidebar} data-collapsed={collapsed ? "true" : "false"}>
      <NavLink to="/explore" className={styles.brand ?? ""}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.brandText}>{APP_NAME}</span>
      </NavLink>

      <nav aria-label={t("shell.primaryNavigation")} className={styles.nav}>
        <ul className={styles.list}>
          {NAV_ITEMS.filter((item) => showDesign || !item.designOnly).map((item) => {
            const Icon = item.icon;
            const label = t(item.titleKey);
            return (
              <li key={item.to}>
                <NavLink to={item.to} aria-label={label} className={styles.navLink ?? ""}>
                  <span className={styles.marker} aria-hidden="true" />
                  <Icon size={18} aria-hidden="true" className={styles.icon} />
                  <span className={styles.label}>{label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={styles.footer}>
        <IconButton
          label={collapsed ? t("shell.expandSidebar") : t("shell.collapseSidebar")}
          onClick={onToggle}
          aria-expanded={collapsed ? "false" : "true"}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </IconButton>
      </div>
    </aside>
  );
}
