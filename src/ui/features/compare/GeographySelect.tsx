import { type Geography, geographyName, type Iso3 } from "../../../core/domain/model";
import { useT } from "../../i18n/useT";
import styles from "./CompareControls.module.css";

/** Native geography select for the trajectories tab. */
export function GeographySelect({
  geographies,
  value,
  onChange,
}: {
  readonly geographies: readonly Geography[];
  readonly value: Iso3;
  readonly onChange: (geography: Iso3) => void;
}) {
  const { t, lang } = useT();
  return (
    <label className={styles.field}>
      <span>{t("compare.geography")}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as Iso3)}>
        {[...geographies]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((geography) => (
            <option key={geography.iso3} value={geography.iso3}>
              {geographyName(geography, lang)}
            </option>
          ))}
      </select>
    </label>
  );
}
