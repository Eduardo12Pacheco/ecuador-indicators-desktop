import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { type Indicator, type IndicatorCode, indicatorName } from "../../../core/domain/model";
import { normalizeText } from "../../../core/domain/search";
import { Chip } from "../../design/primitives/Chip/Chip";
import { LiveRegion } from "../../design/primitives/LiveRegion/LiveRegion";
import { VisuallyHidden } from "../../design/primitives/VisuallyHidden/VisuallyHidden";
import { useT } from "../../i18n/useT";
import styles from "./IndicatorMultiPicker.module.css";

/** Minimum and maximum trajectory indicators (S4a). */
export const MIN_INDICATORS = 2;
export const MAX_INDICATORS = 4;

export interface IndicatorMultiPickerProps {
  readonly indicators: readonly Indicator[];
  readonly selected: readonly IndicatorCode[];
  readonly onChange: (indicators: readonly IndicatorCode[]) => void;
}

/**
 * Trajectory indicator selector: removable chips plus a filterable listbox
 * capped at four indicators and never below two (S4a).
 */
export function IndicatorMultiPicker({
  indicators,
  selected,
  onChange,
}: IndicatorMultiPickerProps) {
  const { t, lang } = useT();
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedIndicators = selected
    .map((code) => indicators.find((indicator) => indicator.code === code))
    .filter((indicator): indicator is Indicator => indicator !== undefined);
  const available = useMemo(() => {
    const candidates = indicators.filter((indicator) => !selected.includes(indicator.code));
    if (query.trim() === "") {
      return [...candidates].sort((left, right) => left.sortOrder - right.sortOrder);
    }
    const normalized = normalizeText(query);
    return candidates
      .filter((indicator) => {
        const label = normalizeText(indicatorName(indicator, lang));
        return label.includes(normalized) || normalizeText(indicator.code).includes(normalized);
      })
      .sort((left, right) => left.sortOrder - right.sortOrder);
  }, [indicators, lang, query, selected]);

  const atMax = selected.length >= MAX_INDICATORS;

  const moveActive = (next: number) => {
    if (available.length === 0) {
      return;
    }
    const index = Math.max(0, Math.min(next, available.length - 1));
    setActiveIndex(index);
    optionRefs.current[index]?.focus();
  };

  const add = (indicator: Indicator | undefined) => {
    if (indicator === undefined) {
      return;
    }
    if (atMax) {
      setMessage(t("compare.indicatorPicker.max"));
      return;
    }
    setMessage("");
    onChange([...selected, indicator.code]);
  };

  const remove = (indicator: IndicatorCode) => {
    if (selected.length <= MIN_INDICATORS) {
      setMessage(t("compare.indicatorPicker.min"));
      return;
    }
    setMessage("");
    onChange(selected.filter((code) => code !== indicator));
  };

  return (
    <section className={styles.control} aria-labelledby="compare-indicators-title">
      <h3 id="compare-indicators-title" className={styles.title}>
        {t("compare.indicatorPicker.title")}
      </h3>
      <div className={styles.chips}>
        {selectedIndicators.map((indicator) => {
          const label = indicatorName(indicator, lang);
          return (
            <Chip key={indicator.code} label={label} onRemove={() => remove(indicator.code)}>
              {label}
            </Chip>
          );
        })}
      </div>
      <label className={styles.filter}>
        <Search aria-hidden="true" size={15} />
        <span className={styles.visuallyHidden}>{t("compare.indicatorPicker.filter")}</span>
        <input
          type="search"
          value={query}
          placeholder={t("compare.indicatorPicker.placeholder")}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
        />
      </label>
      {available.length === 0 ? (
        <p className={styles.noResults} role="status">
          {t("compare.indicatorPicker.noResults", { query })}
        </p>
      ) : (
        <div
          role="listbox"
          aria-label={t("compare.indicatorPicker.title")}
          className={styles.listbox}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActive(activeIndex + 1);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActive(activeIndex - 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              moveActive(0);
            } else if (event.key === "End") {
              event.preventDefault();
              moveActive(available.length - 1);
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              add(available[activeIndex]);
            }
          }}
        >
          {available.map((indicator, index) => {
            const label = indicatorName(indicator, lang);
            return (
              <button
                key={indicator.code}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="option"
                aria-selected={false}
                aria-disabled={atMax}
                tabIndex={index === activeIndex ? 0 : -1}
                className={[styles.option, atMax ? styles.disabled : ""].filter(Boolean).join(" ")}
                onClick={() => add(indicator)}
                onFocus={() => setActiveIndex(index)}
              >
                <VisuallyHidden>{t("compare.indicatorPicker.add", { name: label })}</VisuallyHidden>
                <span className={styles.optionName}>{label}</span>
                <span className={styles.optionCode}>{indicator.code}</span>
              </button>
            );
          })}
        </div>
      )}
      <LiveRegion>{message}</LiveRegion>
    </section>
  );
}
