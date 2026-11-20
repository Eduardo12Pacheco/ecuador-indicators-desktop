#!/usr/bin/env node
/**
 * Vendors the latin subsets of the three UI fonts from Fontsource 5.3.0.
 *
 * `@fontsource-variable/*` are dev dependencies: this script copies the woff2
 * files and the OFL license text into `src/ui/design/fonts/`, which ships in
 * the repository so the app never fetches a font at runtime (S1/S10).
 */

import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetDir = resolve(root, "src/ui/design/fonts");

const FONTS = [
  {
    package: "@fontsource-variable/inter",
    file: "inter-latin-wght-normal.woff2",
    license: "LICENSE-inter.txt",
  },
  {
    package: "@fontsource-variable/fraunces",
    file: "fraunces-latin-wght-normal.woff2",
    license: "LICENSE-fraunces.txt",
  },
  {
    package: "@fontsource-variable/jetbrains-mono",
    file: "jetbrains-mono-latin-wght-normal.woff2",
    license: "LICENSE-jetbrains-mono.txt",
  },
];

mkdirSync(targetDir, { recursive: true });

const copied = [];
for (const font of FONTS) {
  const packageJson = require.resolve(`${font.package}/package.json`);
  const packageDir = dirname(packageJson);
  const woff2 = resolve(packageDir, "files", font.file);
  const license = resolve(packageDir, "LICENSE");

  const licenseText = readFileSync(license, "utf8");
  if (!/SIL OPEN FONT LICENSE/i.test(licenseText)) {
    process.stderr.write(`${font.package} does not ship the expected OFL text\n`);
    process.exit(1);
  }

  copyFileSync(woff2, resolve(targetDir, font.file));
  copyFileSync(license, resolve(targetDir, font.license));
  copied.push(font.file);
}

process.stdout.write(`fonts: ${copied.join(", ")}\n`);
