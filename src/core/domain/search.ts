/**
 * Ranked catalog search backing the command palette (S5).
 *
 * Ranking is a `RankingStrategy` so alternative strategies can be injected and
 * tested without touching the search machinery.
 */

import {
  type Catalog,
  findTopic,
  type Indicator,
  indicatorName,
  type Lang,
  type Topic,
} from "./model";

/** An indicator together with the topic it belongs to. */
export interface RankableIndicator {
  readonly indicator: Indicator;
  readonly topic: Topic;
}

/** A scored search result. */
export interface SearchHit {
  readonly indicator: Indicator;
  readonly topic: Topic;
  readonly score: number;
}

/** Scores how well an indicator matches a query. */
export interface RankingStrategy {
  score(query: string, item: RankableIndicator, lang: Lang): number;
}

/** Diacritic-insensitive, lower-case, whitespace-collapsed text. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Default weights from S5: exact code, name-token prefix, name substring,
 * topic name, description substring.
 */
export class DefaultRankingStrategy implements RankingStrategy {
  score(query: string, item: RankableIndicator, lang: Lang): number {
    const normalizedQuery = normalizeText(query);
    if (normalizedQuery === "") {
      return 0;
    }
    const { indicator, topic } = item;
    if (normalizeText(indicator.code) === normalizedQuery) {
      return 100;
    }
    const name = normalizeText(indicatorName(indicator, lang));
    if (name.split(" ").some((token) => token.startsWith(normalizedQuery))) {
      return 80;
    }
    if (name.includes(normalizedQuery)) {
      return 60;
    }
    const topicName = normalizeText(lang === "es" ? topic.nameEs : topic.nameEn);
    if (topicName.includes(normalizedQuery)) {
      return 40;
    }
    const description = normalizeText(
      lang === "es" ? indicator.descriptionEs : indicator.descriptionEn,
    );
    if (description.includes(normalizedQuery)) {
      return 20;
    }
    return 0;
  }
}

/**
 * Searches the catalog and returns at most 50 hits.
 *
 * Ties are broken by the curated `sort_order` and then by code, so the order is
 * stable even if the catalog array is shuffled.
 */
export function searchCatalog(
  query: string,
  catalog: Catalog,
  lang: Lang,
  strategy: RankingStrategy = new DefaultRankingStrategy(),
): SearchHit[] {
  if (normalizeText(query) === "") {
    return [];
  }
  const hits: SearchHit[] = [];
  for (const indicator of catalog.indicators) {
    const topic = findTopic(catalog, indicator.topicId);
    if (topic === undefined) {
      continue;
    }
    const score = strategy.score(query, { indicator, topic }, lang);
    if (score > 0) {
      hits.push({ indicator, topic, score });
    }
  }
  hits.sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }
    if (left.indicator.sortOrder !== right.indicator.sortOrder) {
      return left.indicator.sortOrder - right.indicator.sortOrder;
    }
    return left.indicator.code.localeCompare(right.indicator.code);
  });
  return hits.slice(0, 50);
}
