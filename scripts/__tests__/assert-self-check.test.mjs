import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { assertSelfCheck, assertSelfCheckFile } from "../assert-self-check.mjs";

const roots = [];

function capture() {
  let text = "";
  return {
    stream: {
      write(chunk) {
        text += String(chunk);
      },
    },
    text: () => text,
  };
}

function validReport() {
  return {
    ok: true,
    app_version: "0.1.0",
    snapshot: {
      schema_version: 1,
      indicators: 38,
      geographies: 7,
      observations: 11_780,
      file_sha256_ok: true,
      origin: "worldbank",
    },
    user_store: { ok: true, schema_version: 1 },
    errors: [],
  };
}

function writeReport(report) {
  const root = mkdtempSync(join(tmpdir(), "ei-self-check-"));
  roots.push(root);
  const path = join(root, "sc.json");
  writeFileSync(path, typeof report === "string" ? report : JSON.stringify(report));
  return path;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("assertSelfCheck", () => {
  it("accepts the expected self-check report", () => {
    const out = capture();
    const code = assertSelfCheck(validReport(), { stdout: out.stream, stderr: capture().stream });
    expect(code).toBe(0);
    expect(out.text()).toContain("self-check report ok");
  });

  it("collects every field that does not match the contract", () => {
    const report = validReport();
    report.ok = false;
    report.snapshot.indicators = 37;
    report.snapshot.geographies = 8;
    report.snapshot.file_sha256_ok = false;
    report.user_store.ok = false;
    report.errors = [{ code: "SNAPSHOT_INVALID", message: "bad" }];
    const err = capture();
    const code = assertSelfCheck(report, { stdout: capture().stream, stderr: err.stream });
    expect(code).toBe(1);
    expect(err.text()).toContain("ok: expected true");
    expect(err.text()).toContain("snapshot.indicators: expected 38");
    expect(err.text()).toContain("snapshot.geographies: expected 7");
    expect(err.text()).toContain("snapshot.file_sha256_ok: expected true");
    expect(err.text()).toContain("user_store.ok: expected true");
    expect(err.text()).toContain("errors: expected an empty array");
  });

  it("reads a report from disk and fails on malformed JSON", () => {
    const err = capture();
    const code = assertSelfCheckFile(writeReport("{not json"), {
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("cannot read self-check report");
  });

  it("fails when the report file is missing", () => {
    const err = capture();
    const code = assertSelfCheckFile(join(tmpdir(), "ei-self-check-missing.json"), {
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("cannot read self-check report");
  });

  it("reads a valid report from disk", () => {
    const out = capture();
    const code = assertSelfCheckFile(writeReport(validReport()), {
      stdout: out.stream,
      stderr: capture().stream,
    });
    expect(code).toBe(0);
    expect(out.text()).toContain("self-check report ok");
  });
});
