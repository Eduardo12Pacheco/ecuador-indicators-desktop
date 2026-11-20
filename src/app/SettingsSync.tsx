/**
 * Applies persisted theme and language preferences once they load (D11).
 *
 * The SQLite/localStorage settings document is authoritative; the mirrored
 * `localStorage` keys only make the first paint flash-free. This component
 * reconciles the providers with the document exactly once per session, so a
 * later toggle in Settings is never overwritten by a stale query response.
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getSettings } from "../core/application/use-cases/settings";
import { useTheme } from "../ui/design/ThemeProvider";
import { useT } from "../ui/i18n/useT";
import { usePorts } from "../ui/ports-context";

/** Headless reconciler mounted by the root providers. */
export function SettingsSync() {
  const ports = usePorts();
  const { setPref: setTheme } = useTheme();
  const { setPref: setLanguage } = useT();
  const applied = useRef(false);
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(ports.settings),
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (applied.current || settings.data?.ok !== true) {
      return;
    }
    applied.current = true;
    setTheme(settings.data.value.theme);
    setLanguage(settings.data.value.language);
  }, [settings.data, setLanguage, setTheme]);

  return null;
}
