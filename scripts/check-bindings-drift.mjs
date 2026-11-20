#!/usr/bin/env node

/**
 * S24 bindings drift gate: regenerate the ts-rs bindings, then fail when the
 * committed files under `src/adapters/tauri/generated` changed.
 *
 * Usage: node scripts/check-bindings-drift.mjs
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function defaultRun(command, args, options) {
  return spawnSync(command, args, { ...options, stdio: "inherit" });
}

/** Regenerates bindings and checks for drift; returns a process exit code. */
export function checkBindingsDrift({
  root = defaultRoot,
  run = defaultRun,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  const generate = run("cargo", ["test", "-p", "indicators-core", "export_bindings"], {
    cwd: root,
  });
  if (generate.error !== undefined) {
    stderr.write(`binding generation failed: ${generate.error.message}\n`);
    return 1;
  }
  if (generate.status !== 0) {
    stderr.write(`binding generation failed with exit code ${generate.status}\n`);
    return 1;
  }

  const diff = run("git", ["diff", "--exit-code", "--", "src/adapters/tauri/generated"], {
    cwd: root,
  });
  if (diff.error !== undefined) {
    stderr.write(`cannot check generated bindings: ${diff.error.message}\n`);
    return 1;
  }
  if (diff.status !== 0) {
    stderr.write(
      "generated bindings are stale: run `npm run check:bindings` locally and commit the diff\n",
    );
    return 1;
  }

  stdout.write("generated bindings are up to date\n");
  return 0;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  process.exitCode = checkBindingsDrift();
}
