import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { appBinary } from "./support";

interface SelfCheckReport {
  ok: boolean;
  app_version: string;
  snapshot: {
    schema_version: number;
    indicators: number;
    geographies: number;
    observations: number;
    file_sha256_ok: boolean;
    origin: string;
  };
  user_store: { ok: boolean; schema_version: number };
  errors: string[];
}

describe("native self-check", () => {
  it("exits 0 and reports the S15 fields without a window", () => {
    const home = mkdtempSync(join(tmpdir(), "ecuador-indicators-selfcheck-"));
    const out = join(home, "self-check.json");

    const result = spawnSync(appBinary, ["--self-check", "--out", out], {
      env: { ...process.env, ECUADOR_INDICATORS_HOME: home },
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(result.status).toBe(0);
    const report = JSON.parse(readFileSync(out, "utf8")) as SelfCheckReport;
    expect(report.ok).toBe(true);
    expect(report.app_version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(report.snapshot.schema_version).toBe(1);
    expect(report.snapshot.indicators).toBe(38);
    expect(report.snapshot.geographies).toBe(7);
    expect(report.snapshot.observations).toBeGreaterThanOrEqual(10_000);
    expect(report.snapshot.file_sha256_ok).toBe(true);
    expect(report.snapshot.origin).not.toBe("");
    expect(report.user_store.ok).toBe(true);
    expect(report.user_store.schema_version).toBeGreaterThan(0);
    expect(report.errors).toEqual([]);
  });
});
