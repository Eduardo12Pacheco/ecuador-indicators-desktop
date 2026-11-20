import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { bumpVersion } from "../bump-version.mjs";
import { readVersions } from "../check-version-sync.mjs";

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

function makeRepo(version = "0.1.0") {
  const root = mkdtempSync(join(tmpdir(), "ei-bump-version-"));
  roots.push(root);
  writeFileSync(
    join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", version, scripts: { test: "vitest" } }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, "Cargo.toml"),
    `[workspace]\nmembers = []\n\n[workspace.package]\nversion = "${version}"\nedition = "2024"\n`,
  );
  mkdirSync(join(root, "src-tauri"));
  writeFileSync(
    join(root, "src-tauri", "tauri.conf.json"),
    `${JSON.stringify({ productName: "Fixture", version }, null, 2)}\n`,
  );
  mkdirSync(join(root, "pipeline"));
  writeFileSync(
    join(root, "pipeline", "pyproject.toml"),
    `[project]\nname = "fixture"\nversion = "${version}"\nrequires-python = ">=3.12"\n`,
  );
  return root;
}

function run(root, overrides = {}) {
  const out = capture();
  const err = capture();
  const code = bumpVersion({ root, stdout: out.stream, stderr: err.stream, ...overrides });
  return { code, out: out.text(), err: err.text() };
}

function snapshot(root) {
  return {
    package: readFileSync(join(root, "package.json"), "utf8"),
    cargo: readFileSync(join(root, "Cargo.toml"), "utf8"),
    tauri: readFileSync(join(root, "src-tauri", "tauri.conf.json"), "utf8"),
    pipeline: readFileSync(join(root, "pipeline", "pyproject.toml"), "utf8"),
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("bumpVersion", () => {
  it("updates exactly the four authoritative version files", () => {
    const root = makeRepo();
    const before = snapshot(root);

    const result = run(root, { version: "0.2.0" });

    expect(result.code).toBe(0);
    expect(result.out).toContain("bumped version 0.1.0 -> 0.2.0");
    expect(readVersions(root).map((row) => row.version)).toEqual([
      "0.2.0",
      "0.2.0",
      "0.2.0",
      "0.2.0",
    ]);
    const after = snapshot(root);
    expect(after.package).not.toBe(before.package);
    expect(after.cargo).not.toBe(before.cargo);
    expect(after.tauri).not.toBe(before.tauri);
    expect(after.pipeline).not.toBe(before.pipeline);
    expect(after.cargo).toContain('edition = "2024"');
    expect(after.package).toContain('"test": "vitest"');
    expect(after.pipeline).toContain('requires-python = ">=3.12"');
    expect(after.tauri).toContain('"productName": "Fixture"');
  });

  it("keeps the four files byte-identical when the target version is already set", () => {
    const root = makeRepo("0.2.0");
    const before = snapshot(root);

    const result = run(root, { version: "0.2.0" });

    expect(result.code).toBe(0);
    expect(result.out).toContain("versions in sync: 0.2.0");
    expect(snapshot(root)).toEqual(before);
  });

  it("checks the current version without writing when --check is set", () => {
    const root = makeRepo("0.1.0");
    const before = snapshot(root);

    const result = run(root, { check: true });

    expect(result.code).toBe(0);
    expect(result.out).toContain("versions in sync: 0.1.0");
    expect(snapshot(root)).toEqual(before);
  });

  it("refuses a downgrade without --force and leaves every file untouched", () => {
    const root = makeRepo("0.2.0");
    const before = snapshot(root);

    const result = run(root, { version: "0.1.9" });

    expect(result.code).toBe(1);
    expect(result.err).toContain("refusing to downgrade 0.2.0 -> 0.1.9");
    expect(result.err).toContain("--force");
    expect(snapshot(root)).toEqual(before);
  });

  it("allows a downgrade with --force", () => {
    const root = makeRepo("0.2.0");

    const result = run(root, { version: "0.1.9", force: true });

    expect(result.code).toBe(0);
    expect(readVersions(root).map((row) => row.version)).toEqual([
      "0.1.9",
      "0.1.9",
      "0.1.9",
      "0.1.9",
    ]);
  });

  it("rejects a version that is not SemVer and writes nothing", () => {
    const root = makeRepo();
    const before = snapshot(root);

    const result = run(root, { version: "1.0" });

    expect(result.code).toBe(1);
    expect(result.err).toContain("not a valid semantic version");
    expect(snapshot(root)).toEqual(before);
  });

  it("fails --check when the manifests disagree", () => {
    const root = makeRepo();
    writeFileSync(
      join(root, "pipeline", "pyproject.toml"),
      '[project]\nname = "fixture"\nversion = "0.2.0"\n',
    );

    const result = run(root, { check: true });

    expect(result.code).toBe(1);
    expect(result.err).toContain("versions out of sync");
  });

  it("requires a version unless --check is set", () => {
    const root = makeRepo();
    const result = run(root);
    expect(result.code).toBe(1);
    expect(result.err).toContain("--check or a version argument is required");
  });
});
