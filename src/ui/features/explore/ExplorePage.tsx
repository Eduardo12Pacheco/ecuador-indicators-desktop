import { useParams } from "react-router";

import { useT } from "../../i18n/useT";

/** Explore placeholder; T8 replaces it with the catalog, chart and KPIs. */
export function ExplorePage() {
  const { t } = useT();
  const { code } = useParams();
  return (
    <section aria-labelledby="explore-title">
      <h1 id="explore-title">{t("page.explore.title")}</h1>
      <p>{t("page.explore.description")}</p>
      {code ? <p data-testid="explore-code">{code}</p> : null}
    </section>
  );
}
