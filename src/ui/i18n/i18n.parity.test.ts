import { describe, expect, it } from "vitest";

import { en } from "./en";
import { es } from "./es";

type Params = Readonly<Record<string, string>>;

function paramsOf(template: string): Params {
  const found: Record<string, string> = {};
  for (const match of template.matchAll(/\{([a-z]+)\}/g)) {
    if (match[1] !== undefined) found[match[1]] = match[1];
  }
  return found;
}

describe("translation dictionaries", () => {
  it("have exactly the same keys", () => {
    expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort());
  });

  it("have no empty or whitespace-only strings", () => {
    for (const [key, value] of Object.entries(en)) {
      expect(value.trim(), `en.${key}`).not.toBe("");
    }
    for (const [key, value] of Object.entries(es)) {
      expect(value.trim(), `es.${key}`).not.toBe("");
    }
  });

  it("interpolate the same parameters in both languages", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(paramsOf(es[key]), `es.${key}`).toEqual(paramsOf(en[key]));
    }
  });

  it("provide every plural category used by the app in both languages", () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith("_one")) {
        const other = `${key.slice(0, -4)}_other` as keyof typeof en;
        expect(en[other], `en.${other}`).toBeDefined();
        expect(es[key as keyof typeof es]).toBeDefined();
        expect(es[other]).toBeDefined();
      }
    }
  });
});
