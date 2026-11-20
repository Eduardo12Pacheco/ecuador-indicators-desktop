import { useI18nContext } from "./I18nProvider";

/** Hook used by every component to translate strings. */
export function useT() {
  return useI18nContext();
}
