import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("echarts/core", () => ({
  use: vi.fn(),
  init: (...args: unknown[]) => init(...args),
}));

import { createEchartsRenderer } from "./echarts-renderer";

interface FakeInstance {
  readonly setOption: ReturnType<typeof vi.fn>;
  readonly dispatchAction: ReturnType<typeof vi.fn>;
  readonly getDataURL: ReturnType<typeof vi.fn>;
  readonly resize: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

let instance: FakeInstance;
let resizeCallback: (() => void) | null = null;

beforeEach(() => {
  instance = {
    setOption: vi.fn(),
    dispatchAction: vi.fn(),
    getDataURL: vi.fn(() => "data:image/png;base64,abc"),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  resizeCallback = null;
  init.mockReturnValue(instance);
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      resizeCallback = callback;
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {
      resizeCallback = null;
    }
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  init.mockReset();
});

describe("createEchartsRenderer", () => {
  it("initializes a canvas chart with the device pixel ratio", () => {
    const element = document.createElement("div");
    createEchartsRenderer(element);
    expect(init).toHaveBeenCalledWith(element, undefined, {
      renderer: "canvas",
      devicePixelRatio:
        typeof globalThis.devicePixelRatio === "number" ? globalThis.devicePixelRatio : 1,
    });
  });

  it("delegates option, tooltip, resize and data URL operations", () => {
    const renderer = createEchartsRenderer(document.createElement("div"));
    renderer.setOption({ series: [] });
    expect(instance.setOption).toHaveBeenCalledWith({ series: [] }, { notMerge: true });
    renderer.showTip(3, 2);
    expect(instance.dispatchAction).toHaveBeenCalledWith({
      type: "showTip",
      seriesIndex: 2,
      dataIndex: 3,
    });
    renderer.hideTip();
    expect(instance.dispatchAction).toHaveBeenCalledWith({ type: "hideTip" });
    renderer.resize();
    expect(instance.resize).toHaveBeenCalled();
    expect(renderer.toDataURL()).toBe("data:image/png;base64,abc");
    expect(instance.getDataURL).toHaveBeenCalledWith({ type: "png", pixelRatio: 2 });
    expect(renderer.toDataURL({ pixelRatio: 3 })).toBe("data:image/png;base64,abc");
    expect(instance.getDataURL).toHaveBeenCalledWith({ type: "png", pixelRatio: 3 });
  });

  it("resizes through the ResizeObserver and disposes cleanly", () => {
    const renderer = createEchartsRenderer(document.createElement("div"));
    resizeCallback?.();
    expect(instance.resize).toHaveBeenCalledTimes(1);
    renderer.dispose();
    expect(instance.dispose).toHaveBeenCalledTimes(1);
    expect(resizeCallback).toBeNull();
  });

  it("works without a ResizeObserver", () => {
    globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
    const renderer = createEchartsRenderer(document.createElement("div"));
    expect(() => renderer.dispose()).not.toThrow();
  });
});
