/**
 * First-paint bootstrap for theme and language (D11).
 *
 * The plan called for an inline script in `index.html`; S34's strict CSP
 * (`script-src 'self'`) forbids inline scripts, so this module runs before
 * React mounts and before the first meaningful paint instead. It only touches
 * the mirrored localStorage keys inside try/catch: settings stay authoritative.
 */

import { applyTheme, isThemePref } from "../ui/design/theme";
import { isLang } from "../ui/i18n/i18n";

try {
  const theme = localStorage.getItem("ei:theme");
  if (isThemePref(theme)) {
    applyTheme(theme);
  }
  const lang = localStorage.getItem("ei:lang");
  if (isLang(lang)) {
    document.documentElement.lang = lang;
  }
} catch {
  // Blocked storage must never prevent the app from starting.
}
