#!/usr/bin/env node

/**
 * Collects the installers produced by `tauri build` and renames them with the
 * D28 release asset pattern:
 *
 *   ecuador-indicators_<version>_<platform>_<arch>.<ext>
 *
 * Usage: node scripts/collect-artifacts.mjs \
 *   --version 0.1.0 --platform linux --arch x64 \
 *   --target-dir target/release/bundle --out release-assets [--allow-missing]
 *
 * Expected installer types per platform:
 *   linux   deb, rpm, AppImage
 *   windows setup.exe (NSIS), msi
 *   macos   dmg
 *
 * Without `--allow-missing` every expected type must exist; local development
 * can request only the bundles that were actually built.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PLATFORMS = ["linux", "windows", "macos"];
export const ARCHITECTURES = ["x64", "arm64"];

const EXPECTED = {
  linux: [
    { label: "deb installer", extension: ".deb", assetExtension: "deb" },
    { label: "rpm installer", extension: ".rpm", assetExtension: "rpm" },
    { label: "AppImage installer", extension: ".AppImage", assetExtension: "AppImage" },
  ],
  windows: [
    { label: "NSIS setup.exe installer", extension: ".exe", assetExtension: "exe" },
    { label: "MSI installer", extension: ".msi", assetExtension: "msi" },
  ],
  macos: [{ label: "dmg installer", extension: ".dmg", assetExtension: "dmg" }],
};

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(path));
    } else if (entry.isFile()) {
      files.push(path);
    }
  }
  return files.sort();
}

function validateVersion(version) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`invalid version ${JSON.stringify(version)}`);
  }
}

/** Builds the D28 asset file name for one installer type. */
export function assetName({ version, platform, arch, assetExtension }) {
  return `ecuador-indicators_${version}_${platform}_${arch}.${assetExtension}`;
}

/** Copies the built installers to `outDir` with deterministic names. */
export function collectArtifacts({
  version,
  platform,
  arch,
  targetDir,
  outDir,
  allowMissing = false,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let expected;
  try {
    expected = EXPECTED[platform];
    if (expected === undefined) {
      throw new Error(
        `unsupported platform ${JSON.stringify(platform)} (expected one of ${PLATFORMS.join(", ")})`,
      );
    }
    if (!ARCHITECTURES.includes(arch)) {
      throw new Error(
        `unsupported architecture ${JSON.stringify(arch)} (expected one of ${ARCHITECTURES.join(", ")})`,
      );
    }
    validateVersion(version);
    if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
      throw new Error(`bundle directory not found: ${targetDir}`);
    }
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }

  const files = walk(targetDir);
  const selections = [];
  const failures = [];
  for (const type of expected) {
    const matches = files.filter((path) =>
      path.toLowerCase().endsWith(type.extension.toLowerCase()),
    );
    if (matches.length === 0) {
      if (allowMissing) {
        stdout.write(`skipping missing ${type.label}\n`);
      } else {
        failures.push(`missing ${type.label} (${type.extension}) under ${targetDir}`);
      }
      continue;
    }
    if (matches.length > 1) {
      failures.push(
        `more than one ${type.assetExtension} installer found: ${matches
          .map((path) => path.slice(targetDir.length + 1))
          .join(", ")}`,
      );
      continue;
    }
    selections.push({ source: matches[0], type });
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      stderr.write(`${failure}\n`);
    }
    return 1;
  }

  if (selections.length === 0) {
    stderr.write(`no installers collected from ${targetDir}\n`);
    return 1;
  }

  mkdirSync(outDir, { recursive: true });
  for (const { source, type } of selections) {
    const destination = join(
      outDir,
      assetName({
        version,
        platform,
        arch,
        assetExtension: type.assetExtension,
      }),
    );
    copyFileSync(source, destination);
    stdout.write(`${source} -> ${destination}\n`);
  }
  stdout.write(
    `collected ${selections.length} installer${selections.length === 1 ? "" : "s"} for ${platform}-${arch}\n`,
  );
  return 0;
}

function parseArgs(argv) {
  const options = {
    version: null,
    platform: null,
    arch: null,
    targetDir: null,
    outDir: null,
    allowMissing: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--allow-missing") {
      options.allowMissing = true;
      continue;
    }
    const flag = argument.split("=")[0];
    const key = {
      "--version": "version",
      "--platform": "platform",
      "--arch": "arch",
      "--target-dir": "targetDir",
      "--out": "outDir",
    }[flag];
    if (key === undefined) {
      throw new Error(`unknown argument: ${argument}`);
    }
    let value;
    if (argument.includes("=")) {
      value = argument.slice(argument.indexOf("=") + 1);
    } else {
      index += 1;
      value = argv[index];
    }
    if (value === undefined || value === "") {
      throw new Error(`${flag} requires a value`);
    }
    options[key] = key === "targetDir" || key === "outDir" ? resolve(value) : value;
  }
  for (const [flag, key] of [
    ["--version", "version"],
    ["--platform", "platform"],
    ["--arch", "arch"],
    ["--target-dir", "targetDir"],
    ["--out", "outDir"],
  ]) {
    if (options[key] === null) {
      throw new Error(`${flag} is required`);
    }
  }
  return options;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.exitCode = collectArtifacts(parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
