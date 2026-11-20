import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import type { AppPorts } from "../core/application/ports";
import { ToastProvider } from "../ui/design/primitives/Toast/Toast";
import { ThemeProvider } from "../ui/design/ThemeProvider";
import { I18nProvider } from "../ui/i18n/I18nProvider";
import { PortsProvider } from "../ui/ports-context";

/**
 * Composition root for UI-wide context: async cache, language, theme, ports
 * and toasts. One `QueryClient` per mount keeps tests isolated.
 */
export function AppProviders({
  ports,
  children,
}: {
  readonly ports: AppPorts;
  readonly children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <PortsProvider ports={ports}>
            <ToastProvider>{children}</ToastProvider>
          </PortsProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
