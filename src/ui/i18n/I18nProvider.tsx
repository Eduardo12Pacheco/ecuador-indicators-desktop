import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Lang } from "../../core/domain/model";
import type { MessageKey, MessageParams, PluralKey } from "./i18n";
import {
  initialLang,
  localeFor,
  readStoredLang,
  storeLang,
  translate,
  translatePlural,
} from "./i18n";

interface I18nContextValue {
  readonly lang: Lang;
  readonly locale: "en-US" | "es-EC";
  readonly t: (key: MessageKey, params?: MessageParams) => string;
  readonly tp: (key: PluralKey, count: number, params?: MessageParams) => string;
  readonly setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Provides the active language and its translate functions. */
export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    initialLang(
      typeof navigator === "undefined" ? undefined : navigator.language,
      readStoredLang(),
    ),
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    storeLang(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);

  const t = useCallback(
    (key: MessageKey, params: MessageParams = {}) => translate(lang, key, params),
    [lang],
  );
  const tp = useCallback(
    (key: PluralKey, count: number, params: MessageParams = {}) =>
      translatePlural(lang, key, count, params),
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, locale: localeFor(lang), t, tp, setLang }),
    [lang, t, tp, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Internal accessor shared by `useT`; throws outside the provider. */
export function useI18nContext(): I18nContextValue {
  const value = useContext(I18nContext);
  if (value === null) {
    throw new Error("useT must be used inside I18nProvider");
  }
  return value;
}
