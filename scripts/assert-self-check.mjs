#!/usr/bin/env node

/**
 * Validates the S15 self-check report produced by `--self-check --out`.
 *
 * Usage: node scripts/assert-self-check.mjs <report.json>
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns one message per contract violation (empty when the report is good). */
export function validateSelfCheck(report) {
  const failures = [];
  if (!isObject(report)) {
    return ["report: expected a JSON object"];
  }
  if (report.ok !== true) {
    failures.push(`ok: expected true, got ${JSON.stringify(report.ok)}`);
  }
  if (!isObject(report.snapshot)) {
    failures.push("snapshot: expected an object");
  } else {
    if (report.snapshot.indicators !== 38) {
      failures.push(
        `snapshot.indicators: expected 38, got ${JSON.stringify(report.snapshot.indicators)}`,
      );
    }
    if (report.snapshot.geographies !== 7) {
      failures.push(
        `snapshot.geographies: expected 7, got ${JSON.stringify(report.snapshot.geographies)}`,
      );
    }
    if (report.snapshot.file_sha256_ok !== true) {
      failures.push(
        `snapshot.file_sha256_ok: expected true, got ${JSON.stringify(report.snapshot.file_sha256_ok)}`,
      );
    }
  }
  if (!isObject(report.user_store) || report.user_store.ok !== true) {
    failures.push("user_store.ok: expected true");
  }
  if (!Array.isArray(report.errors) || report.errors.length !== 0) {
    failures.push("errors: expected an empty array");
  }
  return failures;
}

/** Validates an in-memory report; returns a process exit code. */
export function assertSelfCheck(report, { stdout = process.stdout, stderr = process.stderr } = {}) {
  const failures = validateSelfCheck(report);
  if (failures.length > 0) {
    for (const failure of failures) {
      stderr.write(`self-check failed: ${failure}\n`);
    }
    return 1;
  }
  stdout.write("self-check report ok\n");
  return 0;
}

/** Validates a report file; returns a process exit code. */
export function assertSelfCheckFile(
  path,
  { stdout = process.stdout, stderr = process.stderr } = {},
) {
  let report;
  try {
    report = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    stderr.write(`cannot read self-check report ${path}: ${error.message}\n`);
    return 1;
  }
  return assertSelfCheck(report, { stdout, stderr });
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const path = process.argv[2];
  if (path === undefined) {
    process.stderr.write("usage: node scripts/assert-self-check.mjs <report.json>\n");
    process.exitCode = 2;
  } else {
    process.exitCode = assertSelfCheckFile(path);
  }
}
