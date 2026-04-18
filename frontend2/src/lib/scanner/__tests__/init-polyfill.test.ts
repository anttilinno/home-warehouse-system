/**
 * Unit tests for lib/scanner/init-polyfill.ts
 *
 * Covers:
 * - isBarcodeDetectionAvailable feature detection
 * - initBarcodePolyfill short-circuits on native support
 * - initBarcodePolyfill idempotent via polyfillLoaded flag
 * - dynamic import("barcode-detector/polyfill") when native is absent
 *
 * Each test resets the module to get a fresh polyfillLoaded flag.
 */
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";

// Mock the polyfill module so dynamic import resolves without touching the
// real package. The mock is hoisted by Vitest.
vi.mock("barcode-detector/polyfill", () => ({}));

describe("lib/scanner/init-polyfill", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("Test 1: isBarcodeDetectionAvailable returns true when BarcodeDetector is on window", async () => {
    vi.stubGlobal("window", { BarcodeDetector: class {} });
    const mod = await import("../init-polyfill");
    expect(mod.isBarcodeDetectionAvailable()).toBe(true);
  });

  it("Test 2: isBarcodeDetectionAvailable returns false when BarcodeDetector is absent", async () => {
    vi.stubGlobal("window", {});
    const mod = await import("../init-polyfill");
    expect(mod.isBarcodeDetectionAvailable()).toBe(false);
  });

  it("Test 3: initBarcodePolyfill early-returns without dynamic import when native is available", async () => {
    vi.stubGlobal("window", { BarcodeDetector: class {} });
    const mod = await import("../init-polyfill");

    // If native is present, the function completes synchronously (no await
    // needed for the polyfill import). Assert it resolves quickly.
    await expect(mod.initBarcodePolyfill()).resolves.toBeUndefined();
    // Second call is also a no-op via polyfillLoaded flag
    await expect(mod.initBarcodePolyfill()).resolves.toBeUndefined();
  });

  it("Test 4: initBarcodePolyfill is idempotent — second call short-circuits via polyfillLoaded", async () => {
    // Use native-available path (which sets polyfillLoaded = true and returns)
    vi.stubGlobal("window", { BarcodeDetector: class {} });
    const mod = await import("../init-polyfill");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await mod.initBarcodePolyfill();
    await mod.initBarcodePolyfill();
    await mod.initBarcodePolyfill();

    // "Native Barcode Detection API available" logs only once because
    // subsequent calls short-circuit on the polyfillLoaded flag.
    const nativeLogs = logSpy.mock.calls.filter((args) =>
      String(args[0]).includes("Native Barcode Detection API available")
    );
    expect(nativeLogs).toHaveLength(1);
  });

  it("Test 5: when native is absent, initBarcodePolyfill awaits dynamic import('barcode-detector/polyfill')", async () => {
    vi.stubGlobal("window", {});
    const mod = await import("../init-polyfill");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await mod.initBarcodePolyfill();

    // After the polyfill branch completes, the success-log line fires.
    const polyfillLogs = logSpy.mock.calls.filter((args) =>
      String(args[0]).includes("Barcode Detection API polyfill registered")
    );
    expect(polyfillLogs).toHaveLength(1);
  });
});
