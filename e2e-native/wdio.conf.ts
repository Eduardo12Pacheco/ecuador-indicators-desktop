/**
 * Native WebdriverIO configuration for the real Tauri window (T12, D18).
 *
 * `tauri-driver` is spawned once per run and proxies the platform WebDriver
 * (`WebKitWebDriver` on Linux). Each run gets a fresh `ECUADOR_INDICATORS_HOME`
 * so saved views and settings start clean; `persistence.e2e.ts` restarts the
 * session against the same home on purpose.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";

const configDir = dirname(fileURLToPath(import.meta.url));

// Ports stay in the 18000-18999 range reserved for this repository so parallel
// test runs of other projects never collide with tauri-driver's 4444/4445 defaults.
const DRIVER_PORT = 18444;
const NATIVE_DRIVER_PORT = 18445;
const repoRoot = resolve(configDir, "..");
const isWindows = process.platform === "win32";
const appBinary = resolve(
  repoRoot,
  "target/release",
  isWindows ? "ecuador-indicators.exe" : "ecuador-indicators",
);

let driver: ChildProcess | null = null;
let driverHome = "";

function isExecutable(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function findExecutable(name: string): string | null {
  const names = isWindows ? [`${name}.exe`, name] : [name];
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

function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolvePromise, reject) => {
    const attempt = (): void => {
      if (driver !== null && driver.exitCode !== null) {
        reject(new Error(`tauri-driver exited with code ${driver.exitCode} before listening`));
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`tauri-driver did not listen on 127.0.0.1:${port} in time`));
        return;
      }
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolvePromise();
      });
      socket.once("error", () => {
        socket.destroy();
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

export async function onPrepare(): Promise<void> {
  const driverPath =
    findExecutable("tauri-driver") ??
    (isExecutable(join(process.env.HOME ?? "", ".cargo", "bin", "tauri-driver"))
      ? join(process.env.HOME ?? "", ".cargo", "bin", "tauri-driver")
      : null);
  if (driverPath === null) {
    throw new Error("tauri-driver is not installed; run scripts/native-e2e-prereqs.mjs");
  }
  if (!isExecutable(appBinary)) {
    throw new Error(`missing native binary ${appBinary}; run: npx tauri build --no-bundle`);
  }

  driverHome = mkdtempSync(join(tmpdir(), "ecuador-indicators-native-"));
  mkdirSync(resolve(configDir, "artifacts"), { recursive: true });

  const driverArgs = ["--port", String(DRIVER_PORT), "--native-port", String(NATIVE_DRIVER_PORT)];
  driver = spawn(driverPath, driverArgs, {
    cwd: configDir,
    env: { ...process.env, ECUADOR_INDICATORS_HOME: driverHome },
    stdio: "inherit",
  });
  await waitForPort(DRIVER_PORT, 30_000);
}

export async function onComplete(): Promise<void> {
  if (driver !== null && driver.exitCode === null) {
    driver.kill("SIGTERM");
  }
  driver = null;
  if (driverHome !== "") {
    rmSync(driverHome, { recursive: true, force: true });
    driverHome = "";
  }
}

export const config = {
  runner: "local",
  hostname: "127.0.0.1",
  port: DRIVER_PORT,
  path: "/",
  specs: ["./specs/*.e2e.ts"],
  maxInstances: 1,
  onPrepare,
  onComplete,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: appBinary,
      },
    },
  ],
  logLevel: "warn" as const,
  framework: "mocha" as const,
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd" as const,
    timeout: 60_000,
  },
  waitforTimeout: 15_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 2,
};
