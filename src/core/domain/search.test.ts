import { assert, integer, property } from "fast-check";
import { describe, expect, it } from "vitest";
import { makeCatalog, makeIndicator, makeTopic } from "../../test/factories";
import { indicatorCode } from "./model";
import {
  DefaultRankingStrategy,
  normalizeText,
  type RankableIndicator,
  type RankingStrategy,
  searchCatalog,
} from "./search";

describe("normalizeText", () => {
  it("strips diacritics, lowercases and collapses whitespace", () => {
    expect(normalizeText("  Inflación   ANUAL ")).toBe("inflacion anual");
    expect(normalizeText("MUJERES")).toBe("mujeres");
  });

  it("is idempotent and diacritic-free", () => {
    assert(
      property(
        integer({ min: 0x20, max: 0x17f }),
        integer({ min: 0, max: 20 }),
        (codePoint, padding) => {
          const input = `${" ".repeat(padding)}${String.fromCodePoint(codePoint)} `;
          const once = normalizeText(input);
          return normalizeText(once) === once && !/[\u0300-\u036f]/.test(once);
        },
      ),
      { seed: 42, numRuns: 100 },
    );
  });
});

describe("DefaultRankingStrategy", () => {
  const strategy = new DefaultRankingStrategy();
  const topic = makeTopic();
  const item: RankableIndicator = {
    topic,
    indicator: makeIndicator({
      nameEn: "Inflation, consumer prices (annual %)",
      nameEs: "Inflación, precios al consumidor (% anual)",
      descriptionEn: "A basket of goods and services.",
    }),
  };

  it("scores exact codes highest", () => {
    expect(strategy.score("NY.GDP.MKTP.CD", item, "en")).toBe(100);
    expect(strategy.score("ny.gdp.mktp.cd", item, "en")).toBe(100);
  });

  it("scores name-token prefixes, substrings, topics and descriptions", () => {
    expect(strategy.score("infl", item, "en")).toBe(80);
    expect(strategy.score("lat", item, "en")).toBe(60);
    expect(strategy.score("econ", item, "en")).toBe(40);
    expect(strategy.score("basket", item, "en")).toBe(20);
    expect(strategy.score("zzz", item, "en")).toBe(0);
    expect(strategy.score("", item, "en")).toBe(0);
  });

  it("matches the Spanish name when the language is Spanish", () => {
    expect(strategy.score("inflacion", item, "es")).toBe(80);
  });
});

describe("searchCatalog", () => {
  it("returns ranked, limited hits", () => {
    const catalog = makeCatalog();
    const hits = searchCatalog("infl", catalog, "en");
    expect(hits[0]?.indicator.code).toBe("FP.CPI.TOTL.ZG");
    expect(hits.map((hit) => hit.score)).toEqual(
      [...hits.map((hit) => hit.score)].sort((a, b) => b - a),
    );
  });

  it("returns nothing for an empty or unmatched query", () => {
    expect(searchCatalog("", makeCatalog(), "en")).toEqual([]);
    expect(searchCatalog("   ", makeCatalog(), "en")).toEqual([]);
    expect(searchCatalog("zzzzzz", makeCatalog(), "en")).toEqual([]);
  });

  it("caps results at 50 and breaks ties by sort order then code", () => {
    const base = makeCatalog();
    const indicators = [];
    for (let index = 0; index < 60; index += 1) {
      indicators.push(
        makeIndicator({
          code: indicatorCode(`TEST.${String(index).padStart(2, "0")}`),
          nameEn: "Test indicator",
          nameEs: "Indicador de prueba",
          sortOrder: index,
        }),
      );
    }
    const hits = searchCatalog("test indicator", { ...base, indicators }, "en");
    expect(hits).toHaveLength(50);
    expect(hits[0]?.indicator.code).toBe("TEST.00");
  });

  it("is deterministic and stable under catalog shuffles that preserve sort_order", () => {
    const catalog = makeCatalog();
    const original = searchCatalog("in", catalog, "en").map((hit) => hit.indicator.code);
    const shuffled = { ...catalog, indicators: [...catalog.indicators].reverse() };
    expect(searchCatalog("in", shuffled, "en").map((hit) => hit.indicator.code)).toEqual(original);
  });

  it("accepts an injected strategy", () => {
    const strategy: RankingStrategy = { score: () => 42 };
    const hits = searchCatalog("x", makeCatalog(), "en", strategy);
    expect(hits).toHaveLength(2);
    expect(hits.every((hit) => hit.score === 42)).toBe(true);
  });

  it("skips indicators whose topic is missing", () => {
    const catalog = makeCatalog();
    const indicators = [
      ...catalog.indicators,
      makeIndicator({ code: indicatorCode("ORPHAN"), topicId: "missing", nameEn: "Orphan" }),
    ];
    expect(searchCatalog("orphan", { ...catalog, indicators }, "en")).toEqual([]);
  });
});
