import { useT } from "../../i18n/useT";

/** Saved views placeholder; T10 adds CRUD and persistence. */
export function ViewsPage() {
  const { t } = useT();
  return (
    <section aria-labelledby="views-title">
      <h1 id="views-title">{t("page.views.title")}</h1>
      <p>{t("page.views.description")}</p>
    </section>
  );
}
