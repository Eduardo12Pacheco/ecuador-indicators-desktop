import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkVersionSync } from "../check-version-sync.mjs";

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

function makeRepo({ pkg = "0.1.0", cargo = "0.1.0", tauri = "0.1.0", pipeline = "0.1.0" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "ei-version-sync-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", version: pkg })}\n`,
  );
  writeFileSync(
    join(root, "Cargo.toml"),
    `[workspace]\nmembers = []\n\n[workspace.package]\nversion = "${cargo}"\nedition = "2024"\n`,
  );
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(
    join(root, "src-tauri", "tauri.conf.json"),
    `${JSON.stringify({ version: tauri })}\n`,
  );
  mkdirSync(join(root, "pipeline"));
  writeFileSync(
    join(root, "pipeline", "pyproject.toml"),
    `[project]\nname = "fixture"\nversion = "${pipeline}"\n`,
  );
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("checkVersionSync", () => {
  it("reports the shared version when every manifest agrees", () => {
    const out = capture();
    const err = capture();
    const code = checkVersionSync({ root: makeRepo(), stdout: out.stream, stderr: err.stream });
    expect(code).toBe(0);
    expect(out.text()).toContain("versions in sync: 0.1.0");
    expect(err.text()).toBe("");
  });

  it("lists every mismatch and fails when one manifest differs", () => {
    const out = capture();
    const err = capture();
    const code = checkVersionSync({
      root: makeRepo({ pipeline: "0.2.0" }),
      stdout: out.stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(out.text()).toContain("package.json: 0.1.0");
    expect(out.text()).toContain("pipeline/pyproject.toml: 0.2.0");
    expect(err.text()).toContain("versions out of sync");
  });

  it("accepts a tag that matches the shared version", () => {
    const out = capture();
    const code = checkVersionSync({
      root: makeRepo(),
      tag: "v0.1.0",
      stdout: out.stream,
      stderr: capture().stream,
    });
    expect(code).toBe(0);
    expect(out.text()).toContain("versions in sync: 0.1.0");
  });

  it("rejects a tag that differs from the shared version", () => {
    const err = capture();
    const code = checkVersionSync({
      root: makeRepo(),
      tag: "v9.9.9",
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("tag v9.9.9 does not match version 0.1.0");
  });

  it("fails on a malformed or missing manifest", () => {
    const root = makeRepo();
    rmSync(join(root, "src-tauri", "tauri.conf.json"));
    const err = capture();
    const code = checkVersionSync({ root, stdout: capture().stream, stderr: err.stream });
    expect(code).toBe(1);
    expect(err.text()).toContain("tauri.conf.json");
  });
});
