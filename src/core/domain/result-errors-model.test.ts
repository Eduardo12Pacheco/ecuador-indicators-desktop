import { describe, expect, it } from "vitest";
import { makeCatalog, makeGeography, makeIndicator, makeTopic } from "../../test/factories";
import { APP_ERROR_CODES, appError, isAppError, isAppErrorCode } from "./errors";
import {
  findGeography,
  findIndicator,
  findTopic,
  geographyName,
  indicatorCode,
  indicatorName,
  indicatorUnit,
  isIso3,
  iso3,
  isYear,
  topicName,
  year,
} from "./model";
import { andThen, err, map, ok, unwrapOr } from "./result";

describe("Result", () => {
  it("wraps success and failure", () => {
    expect(ok(2)).toEqual({ ok: true, value: 2 });
    expect(err("boom")).toEqual({ ok: false, error: "boom" });
  });

  it("maps only the success value", () => {
    expect(map(ok(2), (value) => value * 2)).toEqual({ ok: true, value: 4 });
    expect(map(err("boom"), (value: number) => value * 2)).toEqual({ ok: false, error: "boom" });
  });

  it("chains and short-circuits", () => {
    expect(andThen(ok(2), (value) => ok(value + 1))).toEqual({ ok: true, value: 3 });
    expect(andThen(err("boom"), (value: number) => ok(value + 1))).toEqual({
      ok: false,
      error: "boom",
    });
  });

  it("unwraps or falls back", () => {
    expect(unwrapOr(ok(2), 9)).toBe(2);
    expect(unwrapOr(err("boom"), 9)).toBe(9);
  });
});

describe("AppError", () => {
  it("creates errors with and without details", () => {
    expect(appError("STORAGE", "failed")).toEqual({ code: "STORAGE", message: "failed" });
    expect(appError("STORAGE", "failed", "disk")).toEqual({
      code: "STORAGE",
      message: "failed",
      details: "disk",
    });
  });

  it("recognizes well-formed errors only", () => {
    expect(isAppError(appError("NETWORK", "offline"))).toBe(true);
    expect(isAppError(null)).toBe(false);
    expect(isAppError("x")).toBe(false);
    expect(isAppError({ code: "NOT_A_CODE", message: "x" })).toBe(false);
    expect(isAppError({ code: "NETWORK" })).toBe(false);
  });

  it("validates the code list", () => {
    expect(isAppErrorCode("VIEW_INVALID")).toBe(true);
    expect(isAppErrorCode("NOPE")).toBe(false);
    expect(APP_ERROR_CODES).toContain("INVALID_INPUT");
  });
});

describe("domain model helpers", () => {
  it("guards brands", () => {
    expect(isIso3("ECU")).toBe(true);
    expect(isIso3("ecu")).toBe(false);
    expect(isIso3("EC")).toBe(false);
    expect(isYear(2020)).toBe(true);
    expect(isYear(1899)).toBe(false);
    expect(isYear(2101)).toBe(false);
    expect(isYear(2020.5)).toBe(false);
    expect(indicatorCode("X")).toBe("X");
    expect(iso3("ECU")).toBe("ECU");
    expect(year(2020)).toBe(2020);
  });

  it("localizes names and units", () => {
    const indicator = makeIndicator();
    const geography = makeGeography();
    const topic = makeTopic();
    expect(indicatorName(indicator, "en")).toBe(indicator.nameEn);
    expect(indicatorName(indicator, "es")).toBe(indicator.nameEs);
    expect(indicatorUnit(indicator, "es")).toBe(indicator.unitEs);
    expect(geographyName(geography, "en")).toBe("Ecuador");
    expect(topicName(topic, "es")).toBe("Economía y precios");
  });

  it("trims the stray whitespace the World Bank API puts in some names", () => {
    const geography = makeGeography({
      nameEn: "Latin America & Caribbean ",
      nameEs: "América Latina y el Caribe ",
    });
    expect(geographyName(geography, "en")).toBe("Latin America & Caribbean");
    expect(geographyName(geography, "es")).toBe("América Latina y el Caribe");
  });

  it("finds catalog entries", () => {
    const catalog = makeCatalog();
    expect(findIndicator(catalog, "NY.GDP.MKTP.CD")?.code).toBe("NY.GDP.MKTP.CD");
    expect(findIndicator(catalog, "NOPE")).toBeUndefined();
    expect(findGeography(catalog, "COL")?.iso2).toBe("CO");
    expect(findGeography(catalog, "NOPE")).toBeUndefined();
    expect(findTopic(catalog, "economy")?.id).toBe("economy");
    expect(findTopic(catalog, "nope")).toBeUndefined();
  });
});
