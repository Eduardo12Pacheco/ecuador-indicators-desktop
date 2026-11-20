import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { collectArtifacts } from "../collect-artifacts.mjs";

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

function tempRoot() {
  const root = mkdtempSync(join(tmpdir(), "ei-collect-artifacts-"));
  roots.push(root);
  return root;
}

function writeBundle(root, relativePath, content = relativePath) {
  const path = join(root, relativePath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
  return path;
}

function run(overrides = {}) {
  const out = capture();
  const err = capture();
  const code = collectArtifacts({
    version: "0.1.0",
    platform: "linux",
    arch: "x64",
    targetDir: join(roots[0] ?? tempRoot(), "target", "release", "bundle"),
    outDir: join(tempRoot(), "release-assets"),
    stdout: out.stream,
    stderr: err.stream,
    ...overrides,
  });
  return { code, out: out.text(), err: err.text() };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("collectArtifacts", () => {
  it("names all three Linux installers with the D28 pattern", () => {
    const root = tempRoot();
    const targetDir = join(root, "target", "release", "bundle");
    const outDir = join(root, "release-assets");
    writeBundle(root, "target/release/bundle/deb/ecuador-indicators_0.1.0_amd64.deb", "deb-bytes");
    writeBundle(
      root,
      "target/release/bundle/rpm/ecuador-indicators-0.1.0-1.x86_64.rpm",
      "rpm-bytes",
    );
    writeBundle(
      root,
      "target/release/bundle/appimage/Ecuador Indicators_0.1.0_amd64.AppImage",
      "appimage-bytes",
    );

    const result = run({ targetDir, outDir });

    expect(result.code).toBe(0);
    expect(result.err).toBe("");
    expect(readFileSync(join(outDir, "ecuador-indicators_0.1.0_linux_x64.deb"), "utf8")).toBe(
      "deb-bytes",
    );
    expect(readFileSync(join(outDir, "ecuador-indicators_0.1.0_linux_x64.rpm"), "utf8")).toBe(
      "rpm-bytes",
    );
    expect(readFileSync(join(outDir, "ecuador-indicators_0.1.0_linux_x64.AppImage"), "utf8")).toBe(
      "appimage-bytes",
    );
    expect(result.out).toContain("collected 3 installers");
  });

  it("names both Windows installers with the D28 pattern", () => {
    const root = tempRoot();
    const targetDir = join(root, "target", "release", "bundle");
    const outDir = join(root, "release-assets");
    writeBundle(
      root,
      "target/release/bundle/nsis/Ecuador Indicators_0.1.0_x64-setup.exe",
      "nsis-bytes",
    );
    writeBundle(
      root,
      "target/release/bundle/msi/Ecuador Indicators_0.1.0_x64_en-US.msi",
      "msi-bytes",
    );

    const result = run({ targetDir, outDir, platform: "windows" });

    expect(result.code).toBe(0);
    expect(readFileSync(join(outDir, "ecuador-indicators_0.1.0_windows_x64.exe"), "utf8")).toBe(
      "nsis-bytes",
    );
    expect(readFileSync(join(outDir, "ecuador-indicators_0.1.0_windows_x64.msi"), "utf8")).toBe(
      "msi-bytes",
    );
  });

  it("names the macOS disk image with the D28 pattern", () => {
    const root = tempRoot();
    const targetDir = join(root, "target", "aarch64-apple-darwin", "release", "bundle");
    const outDir = join(root, "release-assets");
    writeBundle(
      root,
      "target/aarch64-apple-darwin/release/bundle/dmg/Ecuador Indicators_0.1.0_aarch64.dmg",
      "dmg-bytes",
    );

    const result = run({ targetDir, outDir, platform: "macos", arch: "arm64" });

    expect(result.code).toBe(0);
    expect(readFileSync(join(outDir, "ecuador-indicators_0.1.0_macos_arm64.dmg"), "utf8")).toBe(
      "dmg-bytes",
    );
  });

  it("fails without --allow-missing and names every missing installer type", () => {
    const root = tempRoot();
    const targetDir = join(root, "target", "release", "bundle");
    const outDir = join(root, "release-assets");
    writeBundle(root, "target/release/bundle/deb/ecuador-indicators_0.1.0_amd64.deb", "deb-bytes");

    const result = run({ targetDir, outDir });

    expect(result.code).toBe(1);
    expect(result.err).toContain("missing rpm installer");
    expect(result.err).toContain("missing AppImage installer");
  });

  it("succeeds with --allow-missing and copies only what exists", () => {
    const root = tempRoot();
    const targetDir = join(root, "target", "release", "bundle");
    const outDir = join(root, "release-assets");
    writeBundle(root, "target/release/bundle/deb/ecuador-indicators_0.1.0_amd64.deb", "deb-bytes");

    const result = run({ targetDir, outDir, allowMissing: true });

    expect(result.code).toBe(0);
    expect(result.out).toContain("ecuador-indicators_0.1.0_linux_x64.deb");
    expect(result.out).toContain("collected 1 installer");
  });

  it("fails when the bundle directory does not exist", () => {
    const result = run({ targetDir: join(tempRoot(), "missing"), allowMissing: true });
    expect(result.code).toBe(1);
    expect(result.err).toContain("bundle directory not found");
  });

  it("fails when two installers of the same type would collide", () => {
    const root = tempRoot();
    const targetDir = join(root, "target", "release", "bundle");
    const outDir = join(root, "release-assets");
    writeBundle(root, "target/release/bundle/deb/a_0.1.0_amd64.deb");
    writeBundle(root, "target/release/bundle/deb/b_0.1.0_amd64.deb");
    writeBundle(root, "target/release/bundle/rpm/a.rpm");
    writeBundle(root, "target/release/bundle/appimage/a.AppImage");

    const result = run({ targetDir, outDir });

    expect(result.code).toBe(1);
    expect(result.err).toContain("more than one deb installer");
  });

  it("rejects an unknown platform", () => {
    const result = run({ platform: "solaris" });
    expect(result.code).toBe(1);
    expect(result.err).toContain("unsupported platform");
  });
});
