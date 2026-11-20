/**
 * Data & About (S31/S32): provenance, attribution, indicator sources, app
 * information, privacy and the bundled third-party notices.
 */

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import notices from "../../../../THIRD_PARTY_NOTICES.md?raw";
import { indicatorName } from "../../../core/domain/model";
import { normalizeText } from "../../../core/domain/search";
import { Button } from "../../design/primitives/Button/Button";
import { Card } from "../../design/primitives/Card/Card";
import { Dialog } from "../../design/primitives/Dialog/Dialog";
import { ErrorState } from "../../design/primitives/ErrorState/ErrorState";
import { Skeleton } from "../../design/primitives/Skeleton/Skeleton";
import { useT } from "../../i18n/useT";
import { usePorts } from "../../ports-context";
import styles from "./AboutPage.module.css";

function formatDate(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

/** Data provenance, indicator sources and application information. */
export function AboutPage() {
  const ports = usePorts();
  const { t, lang, locale } = useT();
  const [filter, setFilter] = useState("");

  const datasetQuery = useQuery({
    queryKey: ["dataset", "info"],
    queryFn: () => ports.dataset.getInfo(),
  });
  const catalogQuery = useQuery({
    queryKey: ["dataset", "catalog"],
    queryFn: () => ports.dataset.getCatalog(),
  });
  const appInfoQuery = useQuery({
    queryKey: ["appInfo"],
    queryFn: () => ports.appInfo.get(),
  });

  if (datasetQuery.isPending || catalogQuery.isPending) {
    return (
      <section className={styles.page} aria-labelledby="about-title">
        <h1 id="about-title">{t("page.about.title")}</h1>
        <Skeleton height={280} />
      </section>
    );
  }

  const dataset = datasetQuery.data?.ok === true ? datasetQuery.data.value : null;
  const catalog = catalogQuery.data?.ok === true ? catalogQuery.data.value : null;
  const appInfo = appInfoQuery.data?.ok === true ? appInfoQuery.data.value : null;

  if (dataset === null || catalog === null) {
    const failure = datasetQuery.data?.ok === false ? datasetQuery.data.error : null;
    return (
      <section className={styles.page} aria-labelledby="about-title">
        <h1 id="about-title">{t("page.about.title")}</h1>
        <ErrorState
          message={failure?.message ?? t("state.error.defaultDescription")}
          onRetry={() => {
            void datasetQuery.refetch();
            void catalogQuery.refetch();
          }}
        />
      </section>
    );
  }

  const attribution = lang === "es" ? dataset.attributionEs : dataset.attributionEn;
  const normalizedFilter = normalizeText(filter);
  const indicators = catalog.indicators.filter((indicator) => {
    if (normalizedFilter === "") {
      return true;
    }
    const haystack = normalizeText(
      [
        indicator.code,
        indicatorName(indicator, lang),
        lang === "es" ? indicator.sourceOrgEs : indicator.sourceOrgEn,
      ].join(" "),
    );
    return haystack.includes(normalizedFilter);
  });

  return (
    <section className={styles.page} aria-labelledby="about-title">
      <header>
        <h1 id="about-title">{t("page.about.title")}</h1>
        <p className={styles.description}>{t("page.about.description")}</p>
      </header>

      <Card>
        <section className={styles.provenance} aria-labelledby="about-provenance">
          <h2 id="about-provenance">{t("about.provenance.title")}</h2>
          <dl className={styles.meta}>
            <div>
              <dt>{t("about.source")}</dt>
              <dd>{dataset.sourceName}</dd>
            </div>
            <div>
              <dt>{t("about.publisher")}</dt>
              <dd>{dataset.sourcePublisher}</dd>
            </div>
            <div>
              <dt>{t("about.license")}</dt>
              <dd>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void ports.externalLinks.open(dataset.licenseUrl)}
                >
                  {dataset.license}
                </Button>
              </dd>
            </div>
            <div>
              <dt>{t("about.retrieved")}</dt>
              <dd>{formatDate(dataset.retrievedAt, locale)}</dd>
            </div>
            <div>
              <dt>{t("about.lastUpdated")}</dt>
              <dd>{formatDate(dataset.sourceLastUpdated, locale)}</dd>
            </div>
            <div>
              <dt>{t("about.counts")}</dt>
              <dd>
                {t("settings.dataset.counts", {
                  indicators: dataset.counts.indicators,
                  geographies: dataset.counts.geographies,
                  observations: dataset.counts.observations,
                })}
              </dd>
            </div>
          </dl>
          <div>
            <h3 className={styles.subheading}>{t("about.attribution.title")}</h3>
            <p className={styles.attribution}>{attribution}</p>
          </div>
        </section>
      </Card>

      <section className={styles.section} aria-labelledby="about-indicators">
        <div className={styles.sectionHeader}>
          <h2 id="about-indicators">{t("about.indicators.title")}</h2>
          <label className={styles.filterLabel} htmlFor="about-filter">
            {t("about.indicators.filter")}
            <input
              id="about-filter"
              type="search"
              className={styles.filter}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <caption className={styles.visuallyHidden}>{t("about.indicators.title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("about.indicators.code")}</th>
                <th scope="col">{t("about.indicators.name")}</th>
                <th scope="col">{t("about.indicators.source")}</th>
              </tr>
            </thead>
            <tbody>
              {indicators.map((indicator) => (
                <tr key={indicator.code}>
                  <td className={styles.code}>{indicator.code}</td>
                  <td>{indicatorName(indicator, lang)}</td>
                  <td>{lang === "es" ? indicator.sourceOrgEs : indicator.sourceOrgEn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.columns}>
        <Card>
          <section aria-labelledby="about-app" className={styles.stack}>
            <h2 id="about-app">{t("about.app.title")}</h2>
            <p>
              {t("about.version")}: <code>{appInfo?.version ?? "—"}</code>
            </p>
            <p>
              {t("about.platform")}: <code>{appInfo?.platform ?? "—"}</code>
            </p>
            <Dialog
              title={t("about.licenses.title")}
              trigger={<Button variant="secondary">{t("about.licenses.open")}</Button>}
            >
              <pre className={styles.notices}>{notices}</pre>
            </Dialog>
          </section>
        </Card>
        <Card>
          <section aria-labelledby="about-privacy" className={styles.stack}>
            <h2 id="about-privacy">{t("about.privacy.title")}</h2>
            <p>{t("about.privacy.body")}</p>
          </section>
        </Card>
      </div>
    </section>
  );
}
