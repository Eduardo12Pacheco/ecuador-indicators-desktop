/**
 * Launch-time update check (S13).
 *
 * Runs only when the setting is enabled and the last successful check is at
 * least 24 hours old. It is notify-only: an available version becomes a toast
 * with the release URL, never a download.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getSettings } from "../../../core/application/use-cases/settings";
import { checkForUpdates } from "../../../core/application/use-cases/updates";
import { useToast } from "../../design/primitives/Toast/Toast";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";

/** Seconds in the update-check throttle window. */
export const UPDATE_CHECK_INTERVAL_S = 24 * 60 * 60;

/** Runs at most one automatic check per session. */
export function useAutoUpdateCheck(): void {
  const ports = usePorts();
  const { t } = useT();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const started = useRef(false);
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(ports.settings),
    staleTime: Number.POSITIVE_INFINITY,
  });

  useEffect(() => {
    if (started.current || settings.data?.ok !== true) {
      return;
    }
    const document = settings.data.value;
    if (!document.updateCheckEnabled) {
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      document.lastUpdateCheck !== null &&
      now - document.lastUpdateCheck < UPDATE_CHECK_INTERVAL_S
    ) {
      return;
    }
    started.current = true;
    void checkForUpdates(ports.updates, false).then(async (result) => {
      if (result.ok && result.value.kind === "available") {
        showToast({
          title: t("settings.updates.available", { version: result.value.latest }),
          description: result.value.url,
          variant: "info",
          durationMs: 12_000,
        });
      }
      if (result.ok) {
        await queryClient.invalidateQueries({ queryKey: ["settings"] });
      }
    });
  }, [ports.updates, queryClient, settings.data, showToast, t]);
}
