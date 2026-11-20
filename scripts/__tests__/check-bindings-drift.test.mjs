import { describe, expect, it } from "vitest";

import { checkBindingsDrift } from "../check-bindings-drift.mjs";

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

function fakeRunner(statuses) {
  const calls = [];
  return {
    calls,
    run(command, args, options) {
      calls.push({ command, args, options });
      const key = `${command} ${args[0]}`;
      return { status: statuses[key] ?? 0 };
    },
  };
}

describe("checkBindingsDrift", () => {
  it("regenerates the bindings and passes when git reports no drift", () => {
    const out = capture();
    const runner = fakeRunner({});
    const code = checkBindingsDrift({
      root: "/repo",
      run: runner.run,
      stdout: out.stream,
      stderr: capture().stream,
    });
    expect(code).toBe(0);
    expect(out.text()).toContain("generated bindings are up to date");
    expect(runner.calls).toHaveLength(2);
    expect(runner.calls[0].command).toBe("cargo");
    expect(runner.calls[0].args).toEqual(["test", "-p", "indicators-core", "export_bindings"]);
    expect(runner.calls[1].command).toBe("git");
    expect(runner.calls[1].args).toEqual([
      "diff",
      "--exit-code",
      "--",
      "src/adapters/tauri/generated",
    ]);
  });

  it("fails without running git when binding generation fails", () => {
    const err = capture();
    const runner = fakeRunner({ "cargo test": 1 });
    const code = checkBindingsDrift({
      root: "/repo",
      run: runner.run,
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("binding generation failed");
    expect(runner.calls).toHaveLength(1);
  });

  it("fails when the generated files differ from the committed ones", () => {
    const err = capture();
    const code = checkBindingsDrift({
      root: "/repo",
      run: fakeRunner({ "git diff": 1 }).run,
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("generated bindings are stale");
  });

  it("fails when binding generation cannot start", () => {
    const err = capture();
    const code = checkBindingsDrift({
      root: "/repo",
      run: () => ({ status: null, error: new Error("cargo not found") }),
      stdout: capture().stream,
      stderr: err.stream,
    });
    expect(code).toBe(1);
    expect(err.text()).toContain("cargo not found");
  });
});
