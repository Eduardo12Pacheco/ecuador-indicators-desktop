/**
 * Keeps the theme/language providers and the persisted settings document in
 * agreement (S8, D11).
 *
 * The SQLite/localStorage settings document is authoritative; the mirrored
 * `localStorage` keys only make the first paint flash-free. This component
 * reconciles the providers with the document exactly once per session and
 * then writes later provider changes (top-bar toggle, shortcuts, palette
 * commands) back to the document, so every entry point persists and the
 * Settings page never shows a stale value.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { getSettings, updateSettings } from "../core/application/use-cases/settings";
import type { Settings } from "../core/domain/model";
import { ok } from "../core/domain/result";
import { useToast } from "../ui/design/primitives/Toast/Toast";
import { useTheme } from "../ui/design/ThemeProvider";
import { useT } from "../ui/i18n/useT";
import { usePorts } from "../ui/ports-context";

type Phase = "loading" | "applying" | "ready";

/** Headless reconciler mounted by the root providers. */
export function SettingsSync() {
  const ports = usePorts();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { pref: themePref, setPref: setTheme } = useTheme();
  const { t, pref: languagePref, setPref: setLanguage } = useT();
  const phase = useRef<Phase>("loading");
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(ports.settings),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const stored = settings.data?.ok === true ? settings.data.value : null;

  // 1. Apply the persisted document once it loads.
  useEffect(() => {
    if (phase.current !== "loading" || stored === null) {
      return;
    }
    phase.current = "applying";
    setTheme(stored.theme);
    setLanguage(stored.language);
  }, [stored, setLanguage, setTheme]);

  // 2. Persist provider changes that happen after the reconciliation.
  useEffect(() => {
    if (phase.current === "loading" || stored === null) {
      return;
    }
    const inSync = stored.theme === themePref && stored.language === languagePref;
    if (phase.current === "applying") {
      phase.current = inSync ? "ready" : "applying";
      return;
    }
    if (inSync) {
      return;
    }
    const next: Settings = { ...stored, theme: themePref, language: languagePref };
    queryClient.setQueryData(["settings"], ok(next));
    void updateSettings(ports.settings, next).then((result) => {
      if (!result.ok) {
        showToast({
          title: t("settings.saveError"),
          description: `${result.error.code}: ${result.error.message}`,
          variant: "danger",
        });
      }
    });
  }, [stored, themePref, languagePref, ports.settings, queryClient, showToast, t]);

  return null;
}
