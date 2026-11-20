#!/usr/bin/env node

/**
 * Verifies that the four release manifests share one semantic version (D21).
 *
 * Usage: node scripts/check-version-sync.mjs [--tag vX.Y.Z]
 *
 * Without `--tag` it only checks the manifests against each other. With a tag
 * it also requires the tag (minus the leading `v`) to equal that version, so a
 * mistyped release tag fails before any installer is built.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readJsonVersion(path, label) {
  let document;
  try {
    document = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${label}: cannot read ${path}: ${error.message}`);
  }
  if (typeof document.version !== "string" || document.version === "") {
    throw new Error(`${label}: missing string "version" in ${path}`);
  }
  return document.version;
}

function sectionVersion(text, section) {
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    const header = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (header !== null) {
      inSection = header[1].trim() === section;
      continue;
    }
    if (!inSection) {
      continue;
    }
    const assignment = /^\s*version\s*=\s*["']([^"']+)["']/.exec(line);
    if (assignment !== null) {
      return assignment[1];
    }
  }
  return null;
}

function readTomlVersion(path, section, label) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    throw new Error(`${label}: cannot read ${path}: ${error.message}`);
  }
  const version = sectionVersion(text, section);
  if (version === null) {
    throw new Error(`${label}: missing "version" in [${section}] of ${path}`);
  }
  return version;
}

/** Reads every authoritative version location and returns labeled rows. */
export function readVersions(root = defaultRoot) {
  return [
    {
      label: "package.json",
      version: readJsonVersion(resolve(root, "package.json"), "package.json"),
    },
    {
      label: "Cargo.toml",
      version: readTomlVersion(resolve(root, "Cargo.toml"), "workspace.package", "Cargo.toml"),
    },
    {
      label: "src-tauri/tauri.conf.json",
      version: readJsonVersion(
        resolve(root, "src-tauri", "tauri.conf.json"),
        "src-tauri/tauri.conf.json",
      ),
    },
    {
      label: "pipeline/pyproject.toml",
      version: readTomlVersion(
        resolve(root, "pipeline", "pyproject.toml"),
        "project",
        "pipeline/pyproject.toml",
      ),
    },
  ];
}

/** Checks version sync; returns a process exit code. */
export function checkVersionSync({
  root = defaultRoot,
  tag = null,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  let rows;
  try {
    rows = readVersions(root);
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }

  const versions = new Set(rows.map((row) => row.version));
  if (versions.size !== 1) {
    for (const row of rows) {
      stdout.write(`${row.label}: ${row.version}\n`);
    }
    stderr.write(
      `versions out of sync: ${rows.map((row) => `${row.label}=${row.version}`).join(", ")}\n`,
    );
    return 1;
  }

  const version = rows[0].version;
  if (tag !== null) {
    const tagVersion = tag.startsWith("v") ? tag.slice(1) : tag;
    if (tagVersion !== version) {
      stderr.write(`tag ${tag} does not match version ${version}\n`);
      return 1;
    }
  }

  stdout.write(`versions in sync: ${version}\n`);
  return 0;
}

function parseArgs(argv) {
  let tag = null;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--tag") {
      tag = argv[index + 1] ?? null;
      index += 1;
    } else if (argv[index].startsWith("--tag=")) {
      tag = argv[index].slice("--tag=".length);
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  if (tag !== null && tag === "") {
    throw new Error("--tag requires a value");
  }
  return { tag };
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { tag } = parseArgs(process.argv.slice(2));
    process.exitCode = checkVersionSync({ tag });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
