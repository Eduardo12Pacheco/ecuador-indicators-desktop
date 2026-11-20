import { describe, expect, it } from "vitest";

import { APP_NAME } from "./app/meta";

describe("application metadata", () => {
  it("exposes the product name", () => {
    expect(APP_NAME).toBe("Ecuador Indicators");
  });
});
