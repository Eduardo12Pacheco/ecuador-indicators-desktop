import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkBundleSize } from "../check-bundle-size.mjs";

const roots = [];

function capture() {
  let text = "";
  return {
    stream: {
      write(chunk) {
        text += String(chunk);
      },
    },
    text: () => text,
  };
}

function makeDist(files) {
  const root = mkdtempSync(join(tmpdir(), "ei-bundle-size-"));
  roots.push(root);
  const assets = join(root, "assets");
  mkdirSync(assets, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const path = join(assets, name);
    mkdirSync(join(path, ".."), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("checkBundleSize", () => {
  it("prints one row per asset plus a total and passes under budget", () => {
    const out = capture();
    const code = checkBundleSize({
      distDir: makeDist({ "index-abc.js": "a".repeat(2000), "chunks/chart.js": "b".repeat(1000) }),
      budget: 716_800,
      stdout: out.stream,
      stderr: capture().stream,
    });
    expect(code).toBe(0);
    expect(out.text()).toContain("assets/index-abc.js");
    expect(out.text()).toContain("assets/chunks/chart.js");
    expect(out.text()).toContain("total");
    expect(out.text()).toContain("716800");
  });

  it("fails when the gzip total exceeds the budget", () => {
    const err = capture();
    const code = checkBundleSize({
      distDir: makeDist({ "index-abc.js": "a".repeat(10_000) }),
      budget: 1,
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("bundle size");
    expect(err.text()).toContain("exceeds budget");
  });

  it("fails when there are no JavaScript assets to measure", () => {
    const err = capture();
    const code = checkBundleSize({
      distDir: makeDist({ "styles.css": "body {}" }),
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("no JavaScript assets");
  });

  it("fails when the dist directory does not exist", () => {
    const err = capture();
    const code = checkBundleSize({
      distDir: join(tmpdir(), "ei-bundle-size-does-not-exist"),
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("dist directory not found");
  });
});
