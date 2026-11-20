import type { Year } from "../../../core/domain/model";
import { Button } from "../../design/primitives/Button/Button";
import { Slider } from "../../design/primitives/Slider/Slider";
import { useT } from "../../i18n/useT";
import styles from "./RangeControl.module.css";

/** The three range presets from S3. */
export type RangePreset = "all" | "10y" | "20y";

/** Resolves a preset against the latest available year. */
export function presetRange(
  preset: RangePreset,
  maxYear: Year,
): { readonly from: Year | null; readonly to: Year | null } {
  if (preset === "all") {
    return { from: null, to: null };
  }
  const span = preset === "10y" ? 9 : 19;
  return { from: (maxYear - span) as Year, to: maxYear };
}

/** Clamps a bound to the available span and keeps `from <= to`. */
export function clampRange(
  from: Year,
  to: Year,
  minYear: Year,
  maxYear: Year,
): { readonly from: Year; readonly to: Year } {
  const lower = Math.max(minYear, Math.min(from, maxYear));
  const upper = Math.max(minYear, Math.min(to, maxYear));
  return lower <= upper
    ? { from: lower as Year, to: upper as Year }
    : { from: upper as Year, to: lower as Year };
}

export interface RangeControlProps {
  readonly years: readonly Year[];
  readonly from: Year | null;
  readonly to: Year | null;
  readonly onRangeChange: (from: Year | null, to: Year | null) => void;
}

/** From/to selects, a two-thumb slider and All/10y/20y presets. */
export function RangeControl({ years, from, to, onRangeChange }: RangeControlProps) {
  const { t, locale } = useT();
  if (years.length === 0) {
    return null;
  }
  const first = years[0] as Year;
  const last = years[years.length - 1] as Year;
  const selectedFrom = from ?? first;
  const selectedTo = to ?? last;
  const isAll = from === null && to === null;

  const tenYear = presetRange("10y", last);
  const twentyYear = presetRange("20y", last);
  const preset: RangePreset | null = isAll
    ? "all"
    : selectedTo === last && selectedFrom === tenYear.from
      ? "10y"
      : selectedTo === last && selectedFrom === twentyYear.from
        ? "20y"
        : null;

  const setFrom = (value: number) => {
    const next = clampRange(value as Year, selectedTo, first, last);
    onRangeChange(next.from, next.to);
  };
  const setTo = (value: number) => {
    const next = clampRange(selectedFrom, value as Year, first, last);
    onRangeChange(next.from, next.to);
  };

  return (
    <section className={styles.control} aria-labelledby="range-title">
      <h3 id="range-title" className={styles.title}>
        {t("explore.range.title")}
      </h3>
      <div className={styles.row}>
        <label className={styles.select}>
          <span>{t("explore.range.from")}</span>
          <select value={selectedFrom} onChange={(event) => setFrom(Number(event.target.value))}>
            {years.map((year) => (
              <option key={year} value={year}>
                {new Intl.NumberFormat(locale, { useGrouping: false }).format(year)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.select}>
          <span>{t("explore.range.to")}</span>
          <select value={selectedTo} onChange={(event) => setTo(Number(event.target.value))}>
            {years.map((year) => (
              <option key={year} value={year}>
                {new Intl.NumberFormat(locale, { useGrouping: false }).format(year)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Slider
        label={t("explore.range.title")}
        min={first}
        max={last}
        value={[selectedFrom, selectedTo]}
        onValueChange={([lower, upper]) => {
          const next = clampRange(lower as Year, upper as Year, first, last);
          onRangeChange(next.from, next.to);
        }}
      />
      <div className={styles.presets}>
        {(
          [
            ["all", t("explore.range.presetAll")],
            ["10y", t("explore.range.preset10")],
            ["20y", t("explore.range.preset20")],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            size="sm"
            variant={preset === value ? "primary" : "ghost"}
            aria-pressed={preset === value}
            onClick={() => {
              const next = presetRange(value, last);
              onRangeChange(next.from, next.to);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
    </section>
  );
}
