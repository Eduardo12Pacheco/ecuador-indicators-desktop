#!/usr/bin/env node

/**
 * Enforces the S33 performance budget: the gzip total of the JavaScript files
 * emitted by the production build (`dist/assets/**\/*.js`) must stay at or
 * below 700 KiB (716800 bytes).
 *
 * Usage: node scripts/check-bundle-size.mjs [--dist dist] [--budget 716800]
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

export const DEFAULT_BUDGET_BYTES = 716_800;

const defaultDist = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function findJavaScriptFiles(directory) {
  const found = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      found.push(...findJavaScriptFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      found.push(path);
    }
  }
  return found.sort();
}

function formatBytes(bytes) {
  return `${bytes} B (${(bytes / 1024).toFixed(2)} KiB)`;
}

/** Measures the gzip size of every emitted JavaScript asset. */
export function collectBundleSizes(distDir = defaultDist) {
  const assetsDir = join(distDir, "assets");
  if (!existsSync(assetsDir)) {
    return [];
  }
  return findJavaScriptFiles(assetsDir).map((path) => ({
    path: relative(distDir, path).split("\\").join("/"),
    gzipBytes: gzipSync(readFileSync(path), { level: 9 }).length,
  }));
}

/** Checks the bundle budget; returns a process exit code. */
export function checkBundleSize({
  distDir = defaultDist,
  budget = DEFAULT_BUDGET_BYTES,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  if (!existsSync(distDir)) {
    stderr.write(`dist directory not found: ${distDir}\n`);
    return 1;
  }

  const rows = collectBundleSizes(distDir);
  if (rows.length === 0) {
    stderr.write(`no JavaScript assets found under ${join(distDir, "assets")}\n`);
    return 1;
  }

  let total = 0;
  stdout.write("gzip size of emitted JavaScript:\n");
  for (const row of rows) {
    total += row.gzipBytes;
    stdout.write(`  ${row.path.padEnd(48)} ${formatBytes(row.gzipBytes)}\n`);
  }
  const percent = ((total / budget) * 100).toFixed(1);
  stdout.write(`  ${"total".padEnd(48)} ${formatBytes(total)} / ${budget} B (${percent}%)\n`);

  if (total > budget) {
    stderr.write(`bundle size ${total} B exceeds budget ${budget} B by ${total - budget} B\n`);
    return 1;
  }
  return 0;
}

function parseArgs(argv) {
  let distDir = defaultDist;
  let budget = DEFAULT_BUDGET_BYTES;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--dist") {
      distDir = resolve(argv[index + 1] ?? "");
      index += 1;
    } else if (argv[index] === "--budget") {
      budget = Number(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${argv[index]}`);
    }
  }
  if (!Number.isInteger(budget) || budget <= 0) {
    throw new Error("--budget must be a positive integer number of bytes");
  }
  return { distDir, budget };
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const { distDir, budget } = parseArgs(process.argv.slice(2));
    process.exitCode = checkBundleSize({ distDir, budget });
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
