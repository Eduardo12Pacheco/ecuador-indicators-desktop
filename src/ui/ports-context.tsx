import { createContext, type ReactNode, useContext } from "react";

import type { AppPorts } from "../core/application/ports";

const PortsContext = createContext<AppPorts | null>(null);

/** Injects the composition root's ports into the UI tree. */
export function PortsProvider({
  ports,
  children,
}: {
  readonly ports: AppPorts;
  readonly children: ReactNode;
}) {
  return <PortsContext.Provider value={ports}>{children}</PortsContext.Provider>;
}

/** Reads the wired ports; throws outside `PortsProvider`. */
export function usePorts(): AppPorts {
  const value = useContext(PortsContext);
  if (value === null) {
    throw new Error("usePorts must be used inside PortsProvider");
  }
  return value;
}
