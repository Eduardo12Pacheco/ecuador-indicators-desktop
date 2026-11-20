import type { Transform, Year } from "../../../core/domain/model";
import { SegmentedControl } from "../../design/primitives/SegmentedControl/SegmentedControl";
import { useT } from "../../i18n/useT";
import styles from "./TransformControl.module.css";

export interface TransformControlProps {
  readonly transform: Transform;
  readonly baseYear: Year | null;
  /** Years shared by every visible series, used as base-year options. */
  readonly baseYears: readonly Year[];
  readonly onChange: (transform: Transform, baseYear: Year | null) => void;
}

/** Level / YoY % / Index selector with a base year shown only for Index. */
export function TransformControl({
  transform,
  baseYear,
  baseYears,
  onChange,
}: TransformControlProps) {
  const { t, locale } = useT();
  return (
    <section className={styles.control} aria-labelledby="transform-title">
      <h3 id="transform-title" className={styles.title}>
        {t("explore.transform.title")}
      </h3>
      <SegmentedControl
        label={t("explore.transform.title")}
        value={transform}
        options={[
          { value: "level", label: t("explore.transform.level") },
          { value: "yoy", label: t("explore.transform.yoy") },
          { value: "index", label: t("explore.transform.index") },
        ]}
        onValueChange={(value) => {
          const next = value as Transform;
          onChange(next, next === "index" ? baseYear : null);
        }}
      />
      {transform === "index" ? (
        <label className={styles.base}>
          <span>{t("explore.transform.baseYear")}</span>
          <select
            value={baseYear === null ? "" : String(baseYear)}
            disabled={baseYears.length === 0}
            onChange={(event) => {
              const value = event.target.value;
              onChange("index", value === "" ? null : (Number(value) as Year));
            }}
          >
            {baseYear === null ? <option value="">—</option> : null}
            {baseYears.length === 0 ? (
              <option value="">{t("explore.transform.noCommonYear")}</option>
            ) : null}
            {baseYears.map((year) => (
              <option key={year} value={year}>
                {new Intl.NumberFormat(locale, { useGrouping: false }).format(year)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </section>
  );
}
