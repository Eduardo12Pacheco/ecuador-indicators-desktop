import type { RankingModel } from "../../../core/application/use-cases/models";
import { formatDelta, formatValue, formatYear } from "../../../core/domain/format";
import { geographyName } from "../../../core/domain/model";
import { useT } from "../../i18n/useT";
import styles from "./RankingTable.module.css";

/** Accessible table alternative to the ranking chart (S4b, S11). */
export function RankingTable({ model }: { readonly model: RankingModel }) {
  const { t, lang, locale } = useT();
  const ecuador = model.ranked.find((row) => row.geography.iso3 === "ECU");
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          {t("compare.ranking.caption", {
            indicator: lang === "es" ? model.indicator.nameEs : model.indicator.nameEn,
            year: formatYear(model.year, locale),
          })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("compare.ranking.rank")}</th>
            <th scope="col">{t("compare.ranking.geography")}</th>
            <th scope="col">{t("compare.ranking.value")}</th>
            <th scope="col">{t("compare.ranking.difference")}</th>
          </tr>
        </thead>
        <tbody>
          {model.ranked.map((row, index) => {
            const isEcuador = row.geography.iso3 === "ECU";
            return (
              <tr
                key={row.geography.iso3}
                data-ecuador={isEcuador ? "true" : undefined}
                aria-current={isEcuador ? "true" : undefined}
                className={isEcuador ? styles.ecuador : undefined}
              >
                <td>{index + 1}</td>
                <th scope="row">{geographyName(row.geography, lang)}</th>
                <td>{formatValue(row.value, model.indicator, locale)}</td>
                <td>
                  {isEcuador || ecuador === undefined
                    ? "—"
                    : formatDelta(row.value - ecuador.value, locale, {
                        decimals: model.indicator.decimals,
                      })}
                </td>
              </tr>
            );
          })}
          {model.missing.map((geography) => (
            <tr key={geography.iso3} data-missing="true" className={styles.missing}>
              <td>—</td>
              <th scope="row">{geographyName(geography, lang)}</th>
              <td>{t("common.noData")}</td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
