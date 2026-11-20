import { describe, expect, it } from "vitest";

import { summarizePlaywright } from "../collect-metrics.mjs";

const spec = (file, title, projects) => ({
  file,
  title,
  tests: projects.map((projectName) => ({ projectName })),
});

describe("summarizePlaywright", () => {
  it("counts distinct scenarios once, however many browsers ran them", () => {
    const report = {
      suites: [
        {
          specs: [spec("a.spec.ts", "first", ["chromium", "webkit"])],
          suites: [{ specs: [spec("a.spec.ts", "second", ["chromium", "webkit"])] }],
        },
        { specs: [spec("b.spec.ts", "first", ["chromium", "webkit"])] },
      ],
    };
    expect(summarizePlaywright(report)).toEqual({
      scenarios: 3,
      projects: ["chromium", "webkit"],
    });
  });

  it("reports only the projects that actually ran", () => {
    const report = { suites: [{ specs: [spec("a.spec.ts", "only", ["chromium"])] }] };
    expect(summarizePlaywright(report)).toEqual({ scenarios: 1, projects: ["chromium"] });
  });

  it("handles an empty report", () => {
    expect(summarizePlaywright({})).toEqual({ scenarios: 0, projects: [] });
  });
});
