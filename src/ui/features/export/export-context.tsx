/**
 * Page-to-shell export registration (S7).
 *
 * The global shortcut registry lives in the shell, but only the active page
 * knows which series and range are visible. Pages register their export
 * handlers here; the shell enables the commands and delegates to them.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/** File kinds the app can export. */
export type FileExportKind = "csv" | "png";

/** Handlers a page can offer. Missing handlers disable that export. */
export interface ExportHandlers {
  readonly csv?: (() => Promise<void>) | undefined;
  readonly png?: (() => Promise<void>) | undefined;
}

/** Availability flags and the delegation surface used by the shell. */
export interface ExportActions {
  readonly available: Readonly<Record<FileExportKind, boolean>>;
  readonly run: (kind: FileExportKind) => void;
  readonly register: (handlers: ExportHandlers) => () => void;
}

const ExportContext = createContext<ExportActions | null>(null);

/** Holds the active page's export handlers. */
export function ExportProvider({ children }: { readonly children: ReactNode }) {
  const [handlers, setHandlers] = useState<ExportHandlers>({});

  const register = useCallback((next: ExportHandlers) => {
    setHandlers(next);
    return () => {
      setHandlers((current) => (current === next ? {} : current));
    };
  }, []);

  const run = useCallback(
    (kind: FileExportKind) => {
      const handler = kind === "csv" ? handlers.csv : handlers.png;
      void handler?.();
    },
    [handlers],
  );

  const value = useMemo<ExportActions>(
    () => ({
      available: { csv: handlers.csv !== undefined, png: handlers.png !== undefined },
      run,
      register,
    }),
    [handlers, register, run],
  );

  return <ExportContext.Provider value={value}>{children}</ExportContext.Provider>;
}

/** Reads the export registry; throws outside `ExportProvider`. */
export function useExportActions(): ExportActions {
  const value = useContext(ExportContext);
  if (value === null) {
    throw new Error("useExportActions must be used inside ExportProvider");
  }
  return value;
}

/** Registers the current page's export handlers for its lifetime. */
export function useRegisterExport(
  csv: (() => Promise<void>) | undefined,
  png: (() => Promise<void>) | undefined,
): void {
  const { register } = useExportActions();
  useEffect(() => register({ csv, png }), [csv, png, register]);
}
