import { useT } from "../../i18n/useT";

/** Compare placeholder; T9 adds trajectories and ranking. */
export function ComparePage() {
  const { t } = useT();
  return (
    <section aria-labelledby="compare-title">
      <h1 id="compare-title">{t("page.compare.title")}</h1>
      <p>{t("page.compare.description")}</p>
    </section>
  );
}
