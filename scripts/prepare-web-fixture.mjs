#!/usr/bin/env node

/**
 * Prepares the JSON snapshot served to the in-memory adapter in web E2E and
 * media-capture builds.
 *
 * Usage: node scripts/prepare-web-fixture.mjs <mini|full>
 */

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = resolve(root, "public", "__fixture__");
const target = resolve(targetDir, "snapshot.json");
const subset = process.argv[2] ?? "mini";

if (subset !== "mini" && subset !== "full") {
  process.stderr.write(`unknown subset "${subset}"; expected mini or full\n`);
  process.exit(2);
}

mkdirSync(targetDir, { recursive: true });

if (subset === "mini") {
  copyFileSync(resolve(root, "src/adapters/memory/fixtures/mini.snapshot.json"), target);
  process.stdout.write(`wrote mini fixture to ${target}\n`);
} else {
  const result = spawnSync(
    "uv",
    [
      "run",
      "--directory",
      "pipeline",
      "ecuador-data",
      "export-json",
      "--subset",
      "full",
      "--out",
      target,
    ],
    { cwd: root, stdio: "inherit" },
  );
  if (result.status !== 0) {
    process.stderr.write("ecuador-data export-json failed\n");
    process.exit(result.status ?? 1);
  }
}
