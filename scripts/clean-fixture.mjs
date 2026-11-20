#!/usr/bin/env node
/**
 * Removes the generated web fixture so a Tauri/production build can never ship
 * `public/__fixture__`. Runs before every `vite build`.
 */

import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public", "__fixture__");

rmSync(target, { recursive: true, force: true });
