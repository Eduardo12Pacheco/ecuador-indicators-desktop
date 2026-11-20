import type { ExploreModel } from "../../../core/application/use-cases/models";
import { formatValue, formatYear } from "../../../core/domain/format";
import { geographyName, indicatorName } from "../../../core/domain/model";
import { alignSeries } from "../../../core/domain/series";
import { VisuallyHidden } from "../../design/primitives/VisuallyHidden/VisuallyHidden";
import { useT } from "../../i18n/useT";
import styles from "./DataTable.module.css";

/** Data-table alternative to the chart (S11). Ecuador's column comes first. */
export function DataTable({ model }: { readonly model: ExploreModel }) {
  const { t, lang, locale } = useT();
  const aligned = alignSeries(model.series);
  const years = aligned.years;
  const first = years[0];
  const last = years[years.length - 1];
  const range =
    first === undefined || last === undefined
      ? "—"
      : `${formatYear(first, locale)}–${formatYear(last, locale)}`;
  const geographyNames = model.series.map((item) => geographyName(item.geography, lang));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <caption className={styles.caption}>
          {t("explore.data.caption", {
            indicator: indicatorName(model.indicator, lang),
            geographies: geographyNames.join(", "),
            range,
          })}
        </caption>
        <thead>
          <tr>
            <th scope="col">{t("common.year")}</th>
            {model.series.map((item) => (
              <th key={item.geography.iso3} scope="col">
                {geographyName(item.geography, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year, index) => (
            <tr key={year}>
              <th scope="row">{formatYear(year, locale)}</th>
              {aligned.columns.map((column, columnIndex) => {
                const value = column[index];
                const geography = model.series[columnIndex]?.geography;
                return (
                  <td key={`${year}-${geography?.iso3 ?? columnIndex}`}>
                    {value === null || value === undefined ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <VisuallyHidden>{t("common.noData")}</VisuallyHidden>
                      </>
                    ) : (
                      formatValue(value, model.indicator, locale)
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {years.length === 0 ? <p className={styles.empty}>{t("explore.chart.noData")}</p> : null}
    </div>
  );
}
