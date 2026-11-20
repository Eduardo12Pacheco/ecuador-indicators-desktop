import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { ThemePref } from "../../core/domain/model";
import {
  applyTheme,
  type ResolvedTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  subscribeSystemTheme,
  systemTheme,
} from "./theme";

interface ThemeContextValue {
  readonly pref: ThemePref;
  readonly resolved: ResolvedTheme;
  readonly setPref: (pref: ThemePref) => void;
  readonly toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Provides the active theme and applies it on every change. */
export function ThemeProvider({ children }: { readonly children: ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>(() => readStoredTheme());
  const [system, setSystem] = useState<ResolvedTheme>(() => systemTheme());

  useEffect(() => subscribeSystemTheme(() => setSystem(systemTheme())), []);

  useEffect(() => {
    applyTheme(pref);
    storeTheme(pref);
  }, [pref]);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
  }, []);

  const resolved = resolveTheme(pref, system);

  const toggle = useCallback(() => {
    setPrefState(resolved === "dark" ? "light" : "dark");
  }, [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({ pref, resolved, setPref, toggle }),
    [pref, resolved, setPref, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Reads the theme context; throws outside `ThemeProvider`. */
export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return value;
}
