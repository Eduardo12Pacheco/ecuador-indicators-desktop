import { useT } from "../../i18n/useT";

/** Data & About placeholder; T10 adds provenance and licences. */
export function AboutPage() {
  const { t } = useT();
  return (
    <section aria-labelledby="about-title">
      <h1 id="about-title">{t("page.about.title")}</h1>
      <p>{t("page.about.description")}</p>
    </section>
  );
}
