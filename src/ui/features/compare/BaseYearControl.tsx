import type { Year } from "../../../core/domain/model";
import { useT } from "../../i18n/useT";
import styles from "./CompareControls.module.css";

/** Native base-year select; explains the empty case when no year is common. */
export function BaseYearControl({
  years,
  value,
  onChange,
}: {
  readonly years: readonly Year[];
  readonly value: Year | null;
  readonly onChange: (year: Year | null) => void;
}) {
  const { t, locale } = useT();
  return (
    <label className={styles.field}>
      <span>{t("compare.baseYear")}</span>
      <select
        value={value ?? ""}
        disabled={years.length === 0}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next === "" ? null : (Number(next) as Year));
        }}
      >
        {value === null ? <option value="">{t("explore.transform.noCommonYear")}</option> : null}
        {years.map((year) => (
          <option key={year} value={year}>
            {new Intl.NumberFormat(locale, { useGrouping: false }).format(year)}
          </option>
        ))}
      </select>
    </label>
  );
}
