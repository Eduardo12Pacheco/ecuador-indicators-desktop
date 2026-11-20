#!/usr/bin/env node

/**
 * Checks the host prerequisites for the native WebdriverIO suite (T12).
 *
 * Native E2E drives the real Tauri window through `tauri-driver`, which uses
 * `WebKitWebDriver` on Linux and needs a display (or `xvfb-run`). The suite is
 * Linux-only per D18, so this script reports every missing item and exits 3
 * instead of starting a run that would hang.
 */

import { existsSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

const isWindows = process.platform === "win32";

function isExecutable(path) {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function findOnPath(name) {
  const names = isWindows ? [`${name}.exe`, `${name}.cmd`, name] : [name];
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory === "") {
      continue;
    }
    for (const candidate of names) {
      const path = join(directory, candidate);
      if (isExecutable(path)) {
        return path;
      }
    }
  }
  return null;
}

function findTool(name, extraDirectories = []) {
  const onPath = findOnPath(name);
  if (onPath !== null) {
    return onPath;
  }
  for (const directory of extraDirectories) {
    const names = isWindows ? [`${name}.exe`, name] : [name];
    for (const candidate of names) {
      const path = join(directory, candidate);
      if (isExecutable(path)) {
        return path;
      }
    }
  }
  return null;
}

const missing = [];

const tauriDriver = findTool("tauri-driver", [join(homedir(), ".cargo", "bin")]);
if (tauriDriver === null) {
  missing.push("tauri-driver (install with: cargo install tauri-driver --locked)");
}

const webkitDriver = findTool("WebKitWebDriver");
if (webkitDriver === null) {
  missing.push("WebKitWebDriver (install the webkit2gtk driver, for example webkit2gtk-driver)");
}

const hasDisplay =
  (process.env.DISPLAY ?? "").trim() !== "" || (process.env.WAYLAND_DISPLAY ?? "").trim() !== "";
const xvfbRun = findTool("xvfb-run");
if (!hasDisplay && xvfbRun === null) {
  missing.push("a display (DISPLAY/WAYLAND_DISPLAY) or xvfb-run");
}

if (missing.length === 0) {
  process.stdout.write("native E2E prerequisites satisfied\n");
  process.exit(0);
}

for (const item of missing) {
  process.stderr.write(`missing: ${item}\n`);
}
process.exit(3);
