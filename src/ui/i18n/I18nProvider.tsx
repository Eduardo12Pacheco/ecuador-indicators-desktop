import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import type { Lang, LangPref } from "../../core/domain/model";
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
  /** Persisted preference; `system` follows the navigator language. */
  readonly pref: LangPref;
  readonly lang: Lang;
  readonly locale: "en-US" | "es-EC";
  readonly t: (key: MessageKey, params?: MessageParams) => string;
  readonly tp: (key: PluralKey, count: number, params?: MessageParams) => string;
  /** Sets an explicit language (convenience for the existing controls). */
  readonly setLang: (lang: Lang) => void;
  readonly setPref: (pref: LangPref) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** Provides the active language and its translate functions. */
export function I18nProvider({ children }: { readonly children: ReactNode }) {
  const [navigatorLanguage] = useState(() =>
    typeof navigator === "undefined" ? undefined : navigator.language,
  );
  const [pref, setPrefState] = useState<LangPref>(() => readStoredLang() ?? "system");
  const lang: Lang = pref === "system" ? initialLang(navigatorLanguage, null) : pref;

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
    storeLang(lang);
  }, [lang]);

  const setPref = useCallback((next: LangPref) => setPrefState(next), []);
  const setLang = useCallback((next: Lang) => setPrefState(next), []);

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
    () => ({ pref, lang, locale: localeFor(lang), t, tp, setLang, setPref }),
    [pref, lang, t, tp, setLang, setPref],
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
