import type { TrajectoriesModel } from "../../../core/application/use-cases/models";
import { formatYear } from "../../../core/domain/format";
import { geographyName, indicatorName } from "../../../core/domain/model";
import { alignSeries } from "../../../core/domain/series";
import { VisuallyHidden } from "../../design/primitives/VisuallyHidden/VisuallyHidden";
import { useT } from "../../i18n/useT";
import styles from "./RankingTable.module.css";

/** Accessible table alternative to the trajectories chart (S11). */
export function TrajectoriesTable({ model }: { readonly model: TrajectoriesModel }) {
  const { t, lang, locale } = useT();
  const aligned = alignSeries(model.series);
  const years = aligned.years;
  const first = years[0];
  const last = years[years.length - 1];
  const range =
    first === undefined || last === undefined
      ? "—"
      : `${formatYear(first, locale)}–${formatYear(last, locale)}`;
  const indicatorNames = model.indicators.map((indicator) => indicatorName(indicator, lang));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          {t("compare.data.caption", {
            indicator: indicatorNames.join(" · "),
            geography: geographyName(model.geography, lang),
            range,
          })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("common.year")}</th>
            {model.series.map((item) => (
              <th key={item.indicator.code} scope="col">
                {indicatorName(item.indicator, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((valueYear, index) => (
            <tr key={valueYear}>
              <th scope="row">{formatYear(valueYear, locale)}</th>
              {aligned.columns.map((column, columnIndex) => {
                const value = column[index];
                const indicator = model.series[columnIndex]?.indicator;
                return (
                  <td key={`${valueYear}-${indicator?.code ?? columnIndex}`}>
                    {value === null || value === undefined ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <VisuallyHidden>{t("common.noData")}</VisuallyHidden>
                      </>
                    ) : (
                      new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {years.length === 0 ? <p className={styles.missing}>{t("explore.chart.noData")}</p> : null}
    </div>
  );
}
