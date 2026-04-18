import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { type ReactElement } from "react";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";

// Mock the real scanner library with our test-infra stand-in. Using a
// factory function that returns the mock module directly (Vitest requires
// sync factory returns; we re-export the mock's bindings).
vi.mock("@yudiel/react-qr-scanner", async () => {
  const mod = await import("@/test/mocks/yudiel-scanner");
  return mod;
});

// Mock the polyfill surface — we observe initBarcodePolyfill is called.
const initBarcodePolyfillMock = vi.fn<() => Promise<void>>();
vi.mock("@/lib/scanner", () => ({
  initBarcodePolyfill: () => initBarcodePolyfillMock(),
}));

import { BarcodeScanner } from "../BarcodeScanner";
import {
  lastScannerProps,
  triggerDecode,
  triggerScannerError,
  resetScannerMock,
} from "@/test/mocks/yudiel-scanner";
import {
  installMediaDevicesMock,
  type FakeMediaStreamTrack,
} from "@/test/mocks/media-devices";

i18n.load("en", {});
i18n.activate("en");

function renderBarcode(
  props: Parameters<typeof BarcodeScanner>[0],
): ReturnType<typeof render> {
  const ui: ReactElement = (
    <I18nProvider i18n={i18n}>
      <BarcodeScanner {...props} />
    </I18nProvider>
  );
  return render(ui);
}

// Non-iOS UA (Android-ish) so the torch probe runs by default.
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Mobile Safari/537.36";
const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

function setUserAgent(ua: string): () => void {
  const original = Object.getOwnPropertyDescriptor(
    window.navigator,
    "userAgent",
  );
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => ua,
  });
  return () => {
    if (original) {
      Object.defineProperty(window.navigator, "userAgent", original);
    } else {
      Object.defineProperty(window.navigator, "userAgent", {
        configurable: true,
        value: "",
      });
    }
  };
}

describe("BarcodeScanner (retro viewfinder wrapper)", () => {
  let restoreMediaDevices: () => void = () => {};
  let restoreUA: () => void = () => {};
  let mediaMock: ReturnType<typeof installMediaDevicesMock> | null = null;

  beforeEach(() => {
    initBarcodePolyfillMock.mockReset();
    initBarcodePolyfillMock.mockResolvedValue(undefined);
    resetScannerMock();
    restoreUA = setUserAgent(ANDROID_UA);
  });

  afterEach(() => {
    cleanup();
    restoreMediaDevices();
    restoreUA();
    restoreMediaDevices = () => {};
    restoreUA = () => {};
    mediaMock = null;
  });

  it("calls initBarcodePolyfill exactly once on mount (Test 1)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() =>
      expect(initBarcodePolyfillMock).toHaveBeenCalledTimes(1),
    );
  });

  it("probes torch via getUserMedia with facingMode=environment then stops the track (Test 2)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: true });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() => {
      expect(mediaMock!.getUserMedia).toHaveBeenCalledTimes(1);
    });
    const firstCallArgs = mediaMock!.getUserMedia.mock.calls[0];
    // Accept either video: { facingMode: "environment" } or
    // video: { facingMode: { ideal: "environment" } }
    const videoConstraint = (
      firstCallArgs[0] as MediaStreamConstraints
    )?.video as { facingMode?: unknown };
    const fm = videoConstraint?.facingMode;
    const matches =
      fm === "environment" ||
      (typeof fm === "object" &&
        fm !== null &&
        (fm as { ideal?: string }).ideal === "environment");
    expect(matches).toBe(true);
    // Track should have been stopped after capability probe
    await waitFor(() => {
      expect((mediaMock!.track as FakeMediaStreamTrack).__state.stopped).toBe(
        true,
      );
    });
    // getCapabilities should have been read
    expect(mediaMock!.track.getCapabilities).toHaveBeenCalled();
  });

  it("iOS UA short-circuits — getUserMedia NOT called + no TORCH button (Test 3)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: true });
    restoreMediaDevices = mediaMock.restore;
    restoreUA();
    restoreUA = setUserAgent(IPHONE_UA);

    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    // Let any microtasks settle
    await waitFor(() =>
      expect(initBarcodePolyfillMock).toHaveBeenCalledTimes(1),
    );
    // getUserMedia must NOT have been called on iOS
    expect(mediaMock!.getUserMedia).not.toHaveBeenCalled();
    // No torch button rendered
    expect(screen.queryByText(/TORCH/)).toBeNull();
  });

  it("does NOT render torch button when capability absent (Test 4)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() =>
      expect(mediaMock!.getUserMedia).toHaveBeenCalledTimes(1),
    );
    // After probe settles, no torch button
    await waitFor(() => {
      expect(screen.queryByText(/TORCH/)).toBeNull();
    });
  });

  it("renders torch button when capability is present (Test 5)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: true });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() => {
      expect(screen.getByText(/TORCH/)).toBeInTheDocument();
    });
  });

  it("passes the SCAN-02 format subset to <Scanner> (Test 6)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() => expect(lastScannerProps.current.formats).toBeDefined());
    expect(lastScannerProps.current.formats).toEqual([
      "qr_code",
      "upc_a",
      "ean_13",
      "code_128",
    ]);
  });

  it("passes paused prop through to <Scanner> on mount and rerender (Test 7)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    const { rerender } = renderBarcode({
      paused: true,
      onDecode: vi.fn(),
      onError: vi.fn(),
    });
    await waitFor(() =>
      expect(lastScannerProps.current.paused).toBe(true),
    );
    rerender(
      <I18nProvider i18n={i18n}>
        <BarcodeScanner paused={false} onDecode={vi.fn()} onError={vi.fn()} />
      </I18nProvider>,
    );
    await waitFor(() =>
      expect(lastScannerProps.current.paused).toBe(false),
    );
  });

  it("sets scanDelay=200 on <Scanner> (Test 8)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() =>
      expect(lastScannerProps.current.scanDelay).toBe(200),
    );
  });

  it("sets sound=false on <Scanner> (Test 9)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() =>
      expect(lastScannerProps.current.sound).toBe(false),
    );
  });

  it("sets components={finder:false, torch:false} on <Scanner> (Test 10)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() =>
      expect(lastScannerProps.current.components).toBeDefined(),
    );
    expect(lastScannerProps.current.components).toEqual({
      finder: false,
      torch: false,
    });
  });

  it("sets constraints.facingMode to 'environment' (Test 11)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() =>
      expect(lastScannerProps.current.constraints).toBeDefined(),
    );
    expect(lastScannerProps.current.constraints?.facingMode).toBe(
      "environment",
    );
  });

  it("sets allowMultiple=false on <Scanner> (Test 12)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    renderBarcode({ paused: false, onDecode: vi.fn(), onError: vi.fn() });
    await waitFor(() =>
      expect(lastScannerProps.current.allowMultiple).toBe(false),
    );
  });

  it("maps decoded barcode to onDecode({ code, format }) (Test 13)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    const onDecode = vi.fn();
    renderBarcode({ paused: false, onDecode, onError: vi.fn() });
    await waitFor(() =>
      expect(lastScannerProps.current.onScan).toBeDefined(),
    );
    triggerDecode("TEST-CODE-123", "qr_code");
    expect(onDecode).toHaveBeenCalledTimes(1);
    expect(onDecode).toHaveBeenCalledWith({
      code: "TEST-CODE-123",
      format: "qr_code",
    });
  });

  it("maps scanner errors to error kinds via onError callback (Test 14)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: false });
    restoreMediaDevices = mediaMock.restore;
    const onError = vi.fn();
    renderBarcode({ paused: false, onDecode: vi.fn(), onError });
    await waitFor(() =>
      expect(lastScannerProps.current.onError).toBeDefined(),
    );
    // NotAllowedError → permission-denied
    triggerScannerError(
      new DOMException("permission denied", "NotAllowedError"),
    );
    expect(onError).toHaveBeenCalledWith("permission-denied");

    // NotFoundError → no-camera
    triggerScannerError(new DOMException("no device", "NotFoundError"));
    expect(onError).toHaveBeenCalledWith("no-camera");

    // OverconstrainedError → no-camera
    triggerScannerError(
      new DOMException("constraint", "OverconstrainedError"),
    );
    expect(onError).toHaveBeenCalledWith("no-camera");

    // NotSupportedError → unsupported-browser
    triggerScannerError(
      new DOMException("unsupported", "NotSupportedError"),
    );
    expect(onError).toHaveBeenCalledWith("unsupported-browser");

    // Unknown → library-init-fail fallback
    triggerScannerError(new Error("something else"));
    expect(onError).toHaveBeenCalledWith("library-init-fail");
  });

  it("cleans up any lingering probe streams on unmount (Test 15 — PATTERNS §S8)", async () => {
    mediaMock = installMediaDevicesMock({ torchSupported: true });
    restoreMediaDevices = mediaMock.restore;
    const { unmount } = renderBarcode({
      paused: false,
      onDecode: vi.fn(),
      onError: vi.fn(),
    });
    await waitFor(() =>
      expect(mediaMock!.getUserMedia).toHaveBeenCalledTimes(1),
    );
    const trackStopSpy = mediaMock!.track.stop;
    unmount();
    // stop() was called on the probe track — either immediately after probe
    // or again on unmount. Assert it was invoked at least once.
    expect(trackStopSpy).toHaveBeenCalled();
  });
});
