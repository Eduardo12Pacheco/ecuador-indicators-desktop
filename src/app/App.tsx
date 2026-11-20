import { useState } from "react";
import { RouterProvider } from "react-router";

import type { AppPorts } from "../core/application/ports";
import { AppProviders } from "./providers";
import { createAppRouter } from "./router";

/** Root component: providers around the hash router. */
export function App({ ports }: { readonly ports: AppPorts }) {
  const [router] = useState(() => createAppRouter());
  return (
    <AppProviders ports={ports}>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
