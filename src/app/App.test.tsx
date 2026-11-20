import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("renders the product name in the main landmark", () => {
    const markup = renderToStaticMarkup(<App />);
    expect(markup).toContain("<main>");
    expect(markup).toContain("Ecuador Indicators");
  });
});
