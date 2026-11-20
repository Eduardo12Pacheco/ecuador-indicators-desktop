import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import type { ExploreModel } from "../../../core/application/use-cases/models";
import { formatDelta, formatTransformedValue, formatYear } from "../../../core/domain/format";
import { indicatorName } from "../../../core/domain/model";
import { type SeriesSummary, summarize } from "../../../core/domain/stats";
import { Card } from "../../design/primitives/Card/Card";
import { useT } from "../../i18n/useT";
import styles from "./KpiRow.module.css";

type Tone = "good" | "bad" | "neutral";

function changeTone(summary: SeriesSummary, higherIs: string): Tone {
  if (summary.change === null || summary.change.abs === 0 || higherIs === "neutral") {
    return "neutral";
  }
  const better = higherIs === "better";
  const rising = summary.change.abs > 0;
  return better === rising ? "good" : "bad";
}

function toneLabel(tone: Tone, t: ReturnType<typeof useT>["t"]): string {
  if (tone === "good") return t("explore.kpi.improved");
  if (tone === "bad") return t("explore.kpi.worsened");
  return t("explore.kpi.changed");
}

function TrendIcon({ direction }: { readonly direction: "up" | "down" | "flat" }) {
  if (direction === "up") return <ArrowUpRight aria-hidden="true" size={18} />;
  if (direction === "down") return <ArrowDownRight aria-hidden="true" size={18} />;
  return <Minus aria-hidden="true" size={18} />;
}

/** Five KPI cards derived from Ecuador's visible series (S3). */
export function KpiRow({ model }: { readonly model: ExploreModel }) {
  const { t, lang, locale } = useT();
  const first = model.series[0];
  if (first === undefined) {
    return null;
  }
  const summary = summarize(first);
  if (summary === null) {
    return null;
  }
  const tone = changeTone(summary, model.indicator.higherIs);
  const direction =
    summary.change === null || summary.change.abs === 0
      ? "flat"
      : summary.change.abs > 0
        ? "up"
        : "down";
  const change = summary.change;
  const valueFor = (value: number) =>
    formatTransformedValue(value, model.indicator, model.transform, locale);

  return (
    <section
      className={styles.row}
      aria-label={t("explore.kpi.region", { name: indicatorName(model.indicator, lang) })}
    >
      <Card as="article" className={styles.card}>
        <p className={styles.label}>{t("explore.kpi.latest")}</p>
        <p className={styles.value} data-testid="kpi-latest">
          {valueFor(summary.latest.value)}
        </p>
        <p className={styles.sub}>
          {formatYear(summary.latest.year, locale)} · {indicatorName(model.indicator, lang)}
        </p>
      </Card>
      <Card as="article" className={styles.card}>
        <p className={styles.label}>{t("explore.kpi.change")}</p>
        <p
          className={[styles.value, styles[tone]].join(" ")}
          data-tone={tone}
          data-direction={direction}
        >
          <TrendIcon direction={direction} />
          {change === null
            ? t("common.noData")
            : formatDelta(change.abs, locale, { decimals: model.indicator.decimals })}
        </p>
        <p className={styles.sub}>
          {change === null
            ? t("explore.kpi.noPrevious")
            : `${change.pct === null ? "—" : formatDelta(change.pct, locale, { percent: true })} · ${toneLabel(tone, t)}`}
        </p>
      </Card>
      <Card as="article" className={styles.card}>
        <p className={styles.label}>{t("explore.kpi.cagr")}</p>
        <p className={styles.value}>
          {summary.cagr === null ? "—" : formatDelta(summary.cagr, locale, { percent: true })}
        </p>
        <p className={styles.sub}>
          {formatYear(summary.firstYear, locale)}–{formatYear(summary.lastYear, locale)}
        </p>
      </Card>
      <Card as="article" className={styles.card}>
        <p className={styles.label}>{t("explore.kpi.min")}</p>
        <p className={styles.value}>{valueFor(summary.min.value)}</p>
        <p className={styles.sub}>{formatYear(summary.min.year, locale)}</p>
      </Card>
      <Card as="article" className={styles.card}>
        <p className={styles.label}>{t("explore.kpi.max")}</p>
        <p className={styles.value}>{valueFor(summary.max.value)}</p>
        <p className={styles.sub}>{formatYear(summary.max.year, locale)}</p>
      </Card>
    </section>
  );
}
