#!/usr/bin/env node

/**
 * Bumps the version in the four authoritative manifests (D21):
 * `package.json`, `Cargo.toml` `[workspace.package]`,
 * `src-tauri/tauri.conf.json` and `pipeline/pyproject.toml`.
 *
 * Usage:
 *   node scripts/bump-version.mjs 0.2.0 [--force]
 *   node scripts/bump-version.mjs --check
 *
 * `--check` only verifies that the four manifests already agree. A downgrade is
 * refused unless `--force` is passed. Every manifest is validated before any
 * file is written, and a failed write restores the files already replaced.
 */

import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { checkVersionSync, readVersions } from "./check-version-sync.mjs";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

function parseSemver(version) {
  const match = SEMVER.exec(version);
  if (match === null) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

/** Returns <0, 0 or >0 for the precedence order of two SemVer strings. */
export function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (a === null || b === null) {
    throw new Error(`cannot compare invalid semantic versions ${left} and ${right}`);
  }
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) {
      return a[key] - b[key];
    }
  }
  if (a.prerelease === b.prerelease) {
    return 0;
  }
  if (a.prerelease === null) {
    return 1;
  }
  if (b.prerelease === null) {
    return -1;
  }
  const leftParts = a.prerelease.split(".");
  const rightParts = b.prerelease.split(".");
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const l = leftParts[index];
    const r = rightParts[index];
    if (l === undefined) {
      return -1;
    }
    if (r === undefined) {
      return 1;
    }
    if (l === r) {
      continue;
    }
    const numericLeft = /^\d+$/.test(l);
    const numericRight = /^\d+$/.test(r);
    if (numericLeft && numericRight) {
      return Number(l) - Number(r);
    }
    if (numericLeft) {
      return -1;
    }
    if (numericRight) {
      return 1;
    }
    return l < r ? -1 : 1;
  }
  return 0;
}

function replaceJsonVersion(path, version) {
  const document = JSON.parse(readFileSync(path, "utf8"));
  document.version = version;
  return `${JSON.stringify(document, null, 2)}\n`;
}

function replaceTomlSectionVersion(path, section, version) {
  const text = readFileSync(path, "utf8");
  const lines = text.split(/\r?\n/);
  let inSection = false;
  let replaced = false;
  const output = lines.map((line) => {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (header !== null) {
      inSection = header[1].trim() === section;
      return line;
    }
    if (!inSection || replaced) {
      return line;
    }
    const assignment = /^(\s*version\s*=\s*)(["'])([^"']*)(\2)(.*)$/.exec(line);
    if (assignment === null) {
      return line;
    }
    replaced = true;
    return `${assignment[1]}${assignment[2]}${version}${assignment[4]}${assignment[5]}`;
  });
  if (!replaced) {
    throw new Error(`missing "version" in [${section}] of ${path}`);
  }
  return output.join(text.includes("\r\n") ? "\r\n" : "\n");
}

function writeAtomically(path, contents) {
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, contents, "utf8");
  try {
    renameSync(temporary, path);
  } catch (error) {
    // Windows cannot rename over an existing file; retry after removing it.
    if (error.code === "EPERM" || error.code === "EEXIST" || error.code === "EACCES") {
      rmSync(path, { force: true });
      renameSync(temporary, path);
      return;
    }
    rmSync(temporary, { force: true });
    throw error;
  }
}

/** Bumps or checks the version; returns a process exit code. */
export function bumpVersion({
  root = defaultRoot,
  version = null,
  check = false,
  force = false,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  if (check) {
    return checkVersionSync({ root, stdout, stderr });
  }
  if (version === null || version === "") {
    stderr.write("--check or a version argument is required\n");
    return 1;
  }
  if (parseSemver(version) === null) {
    stderr.write(`${version} is not a valid semantic version\n`);
    return 1;
  }

  let current;
  try {
    const rows = readVersions(root);
    const versions = new Set(rows.map((row) => row.version));
    if (versions.size !== 1) {
      stderr.write(
        `versions out of sync: ${rows.map((row) => `${row.label}=${row.version}`).join(", ")}\n`,
      );
      return 1;
    }
    current = rows[0].version;
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }

  if (parseSemver(current) === null) {
    stderr.write(`current version ${current} is not a valid semantic version\n`);
    return 1;
  }
  if (!force && compareSemver(version, current) < 0) {
    stderr.write(`refusing to downgrade ${current} -> ${version} without --force\n`);
    return 1;
  }
  if (version === current) {
    stdout.write(`versions in sync: ${current}\n`);
    return 0;
  }

  const targets = [
    {
      path: resolve(root, "package.json"),
      read: () => readFileSync(resolve(root, "package.json"), "utf8"),
      render: () => replaceJsonVersion(resolve(root, "package.json"), version),
    },
    {
      path: resolve(root, "Cargo.toml"),
      read: () => readFileSync(resolve(root, "Cargo.toml"), "utf8"),
      render: () =>
        replaceTomlSectionVersion(resolve(root, "Cargo.toml"), "workspace.package", version),
    },
    {
      path: resolve(root, "src-tauri", "tauri.conf.json"),
      read: () => readFileSync(resolve(root, "src-tauri", "tauri.conf.json"), "utf8"),
      render: () => replaceJsonVersion(resolve(root, "src-tauri", "tauri.conf.json"), version),
    },
    {
      path: resolve(root, "pipeline", "pyproject.toml"),
      read: () => readFileSync(resolve(root, "pipeline", "pyproject.toml"), "utf8"),
      render: () =>
        replaceTomlSectionVersion(resolve(root, "pipeline", "pyproject.toml"), "project", version),
    },
  ];

  let renders;
  try {
    renders = targets.map((target) => ({ ...target, contents: target.render() }));
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }

  const backups = targets.map((target) => target.read());
  const written = [];
  try {
    for (const target of renders) {
      writeAtomically(target.path, target.contents);
      written.push(target.path);
    }
  } catch (error) {
    for (let index = written.length - 1; index >= 0; index -= 1) {
      const target = targets.find((candidate) => candidate.path === written[index]);
      if (target !== undefined) {
        try {
          writeAtomically(target.path, backups[targets.indexOf(target)]);
        } catch {
          // Best-effort restore; the original error is the one reported.
        }
      }
    }
    stderr.write(`cannot write version files: ${error.message}\n`);
    return 1;
  }

  stdout.write(`bumped version ${current} -> ${version}\n`);
  return 0;
}

function parseArgs(argv) {
  const options = { version: null, check: false, force: false };
  const positional = [];
  for (const argument of argv) {
    if (argument === "--check") {
      options.check = true;
    } else if (argument === "--force") {
      options.force = true;
    } else if (argument.startsWith("-")) {
      throw new Error(`unknown argument: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  if (positional.length > 1) {
    throw new Error("expected at most one version argument");
  }
  options.version = positional[0] ?? null;
  return options;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    process.exitCode = bumpVersion(parseArgs(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
