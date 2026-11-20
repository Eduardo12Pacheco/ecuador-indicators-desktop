import { ChevronDown } from "lucide-react";

import {
  type Indicator,
  indicatorName,
  indicatorUnit,
  type Topic,
  topicName,
} from "../../../core/domain/model";
import { Chip } from "../../design/primitives/Chip/Chip";
import { useT } from "../../i18n/useT";
import styles from "./IndicatorHeader.module.css";

/** Title block for the selected indicator: name, unit, topic, source, notes. */
export function IndicatorHeader({
  indicator,
  topic,
}: {
  readonly indicator: Indicator;
  readonly topic: Topic | undefined;
}) {
  const { t, lang } = useT();
  const source = lang === "es" ? indicator.sourceOrgEs : indicator.sourceOrgEn;
  const description = lang === "es" ? indicator.descriptionEs : indicator.descriptionEn;
  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <div>
          <p className={styles.code}>{indicator.code}</p>
          <h1 className={styles.title}>{indicatorName(indicator, lang)}</h1>
        </div>
        <span className={styles.unit}>{indicatorUnit(indicator, lang)}</span>
      </div>
      <div className={styles.meta}>
        {topic ? (
          <Chip>
            <span className={styles.topic}>{topicName(topic, lang)}</span>
          </Chip>
        ) : null}
        <span className={styles.source}>{t("explore.header.source", { source })}</span>
      </div>
      <details className={styles.details}>
        <summary>
          <ChevronDown aria-hidden="true" size={15} />
          {t("explore.header.about")}
        </summary>
        <p>{description}</p>
      </details>
    </header>
  );
}
