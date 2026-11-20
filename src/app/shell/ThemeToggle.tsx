import { Moon, Sun } from "lucide-react";

import { IconButton } from "../../ui/design/primitives/IconButton/IconButton";
import { useTheme } from "../../ui/design/ThemeProvider";
import { useT } from "../../ui/i18n/useT";

/** One-click explicit light/dark toggle; "System" lives in Settings. */
export function ThemeToggle() {
  const { t } = useT();
  const { resolved, toggle } = useTheme();
  return (
    <IconButton label={t("shell.toggleTheme")} onClick={toggle}>
      {resolved === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </IconButton>
  );
}
