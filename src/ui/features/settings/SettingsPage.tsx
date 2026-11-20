import { useT } from "../../i18n/useT";

/** Settings placeholder; T10 adds appearance, updates and dataset sections. */
export function SettingsPage() {
  const { t } = useT();
  return (
    <section aria-labelledby="settings-title">
      <h1 id="settings-title">{t("page.settings.title")}</h1>
      <p>{t("page.settings.description")}</p>
    </section>
  );
}
