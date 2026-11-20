import { Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  type Catalog,
  type Indicator,
  indicatorName,
  type Topic,
  topicName,
} from "../../../core/domain/model";
import { searchCatalog } from "../../../core/domain/search";
import { useT } from "../../i18n/useT";
import styles from "./CatalogPanel.module.css";

interface CatalogEntry {
  readonly indicator: Indicator;
  readonly topic: Topic;
}

export interface CatalogPanelProps {
  readonly catalog: Catalog;
  readonly selected: string;
  readonly onSelect: (code: string) => void;
}

/**
 * Accessible single-select indicator list grouped by topic (S3).
 *
 * Filtering reuses the same ranked search as the command palette; the listbox
 * implements roving tabindex so only the active option is in the tab order.
 */
export function CatalogPanel({ catalog, selected, onSelect }: CatalogPanelProps) {
  const { t, lang } = useT();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const entries = useMemo<CatalogEntry[]>(() => {
    if (query.trim() === "") {
      const topics = [...catalog.topics].sort((left, right) => left.sortOrder - right.sortOrder);
      const result: CatalogEntry[] = [];
      for (const topic of topics) {
        const indicators = catalog.indicators
          .filter((indicator) => indicator.topicId === topic.id)
          .sort((left, right) => left.sortOrder - right.sortOrder);
        for (const indicator of indicators) {
          result.push({ indicator, topic });
        }
      }
      return result;
    }
    return searchCatalog(query, catalog, lang).map((hit) => ({
      indicator: hit.indicator,
      topic: hit.topic,
    }));
  }, [catalog, lang, query]);

  const groups = useMemo(() => {
    const byTopic = new Map<string, { topic: Topic; entries: CatalogEntry[]; start: number }>();
    entries.forEach((entry, index) => {
      const existing = byTopic.get(entry.topic.id);
      if (existing === undefined) {
        byTopic.set(entry.topic.id, { topic: entry.topic, entries: [entry], start: index });
      } else {
        existing.entries.push(entry);
      }
    });
    return [...byTopic.values()];
  }, [entries]);

  const moveActive = (next: number) => {
    if (entries.length === 0) {
      return;
    }
    const index = Math.max(0, Math.min(next, entries.length - 1));
    setActiveIndex(index);
    optionRefs.current[index]?.focus();
  };

  const select = (entry: CatalogEntry | undefined) => {
    if (entry !== undefined) {
      onSelect(entry.indicator.code);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="catalog-title">
      <h2 id="catalog-title" className={styles.title}>
        {t("explore.catalog.title")}
      </h2>
      <label className={styles.filter}>
        <Search aria-hidden="true" size={15} />
        <span className={styles.visuallyHidden}>{t("explore.catalog.filter")}</span>
        <input
          type="search"
          value={query}
          placeholder={t("explore.catalog.filterPlaceholder")}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
        />
      </label>
      {entries.length === 0 ? (
        <p className={styles.noResults} role="status">
          {t("explore.catalog.noResults", { query })}
        </p>
      ) : (
        <div
          role="listbox"
          aria-label={t("explore.catalog.title")}
          className={styles.listbox}
          data-testid="catalog-listbox"
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
              moveActive(entries.length - 1);
            } else if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              select(entries[activeIndex]);
            }
          }}
        >
          {groups.map((group) => (
            // biome-ignore lint/a11y/useSemanticElements: listbox groups are ARIA groups, not fieldsets.
            <div key={group.topic.id} role="group" aria-label={topicName(group.topic, lang)}>
              <p className={styles.groupTitle} aria-hidden="true">
                {topicName(group.topic, lang)}
              </p>
              {group.entries.map((entry, offset) => {
                const index = group.start + offset;
                const label = indicatorName(entry.indicator, lang);
                const isSelected = entry.indicator.code === selected;
                return (
                  <button
                    key={entry.indicator.code}
                    ref={(element) => {
                      optionRefs.current[index] = element;
                    }}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-testid="catalog-option"
                    tabIndex={index === activeIndex ? 0 : -1}
                    className={[styles.option, isSelected ? styles.selected : ""]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setActiveIndex(index);
                      onSelect(entry.indicator.code);
                    }}
                    onFocus={() => setActiveIndex(index)}
                  >
                    <span className={styles.optionName}>{label}</span>
                    <span className={styles.optionCode}>{entry.indicator.code}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
