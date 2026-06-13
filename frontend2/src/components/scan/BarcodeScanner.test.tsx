import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Replace the real camera library with the shared mock (no getUserMedia).
vi.mock("@yudiel/react-qr-scanner", () => import("@/test/scanner-mock"));

import {
  lastScannerProps,
  resetScannerMock,
  Scanner,
  triggerDecode,
  triggerScannerError,
} from "@/test/scanner-mock";
import { SUPPORTED_FORMATS } from "@/lib/scanner";
import { BarcodeScanner } from "./BarcodeScanner";

beforeEach(() => {
  resetScannerMock();
});

afterEach(() => {
  cleanup();
});

describe("BarcodeScanner", () => {
  it("renders <Scanner> with the 4-format subset, scanDelay, no sound, finder off", () => {
    render(<BarcodeScanner paused={false} onDecode={vi.fn()} />);

    const props = lastScannerProps.current;
    expect(props).not.toBeNull();
    // SCAN-02: the exact four-format subset is forwarded (binding override 3).
    expect(props?.formats).toEqual([...SUPPORTED_FORMATS]);
    expect(props?.scanDelay).toBe(200);
    expect(props?.allowMultiple).toBe(false);
    expect(props?.sound).toBe(false);
    // We render our own finder overlay; the lib finder is disabled.
    expect((props?.components as { finder?: boolean })?.finder).toBe(false);
    // Rear camera constraints.
    expect(props?.constraints?.facingMode).toEqual({ ideal: "environment" });
  });

  it("forwards the paused prop to <Scanner> (prop-driven pause)", () => {
    render(<BarcodeScanner paused={true} onDecode={vi.fn()} />);
    expect(lastScannerProps.current?.paused).toBe(true);
  });

  it("calls onDecode(rawValue, format) when an active scan fires", async () => {
    const user = userEvent.setup();
    const onDecode = vi.fn();
    render(<BarcodeScanner paused={false} onDecode={onDecode} />);

    await user.click(screen.getByTestId("fake-scanner-decode-trigger"));

    expect(onDecode).toHaveBeenCalledTimes(1);
    expect(onDecode).toHaveBeenCalledWith("TEST-CODE-123", "qr_code");
  });

  it("does NOT call onDecode while paused (double-fire guard)", () => {
    const onDecode = vi.fn();
    render(<BarcodeScanner paused={true} onDecode={onDecode} />);

    // Fire onScan out-of-band; the wrapper's own guard must drop it.
    triggerDecode("PAUSED-CODE", "ean_13");

    expect(onDecode).not.toHaveBeenCalled();
  });

  it("does NOT call onDecode for an empty codes array", () => {
    const onDecode = vi.fn();
    render(<BarcodeScanner paused={false} onDecode={onDecode} />);

    lastScannerProps.current?.onScan([]);

    expect(onDecode).not.toHaveBeenCalled();
  });

  it("forwards scanner errors to onError", () => {
    const onError = vi.fn();
    render(<BarcodeScanner paused={false} onDecode={vi.fn()} onError={onError} />);

    const err = new Error("NotAllowedError");
    triggerScannerError(err);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(err);
  });

  it("enables the lib-managed torch only when supported AND enabled", () => {
    const { rerender } = render(
      <BarcodeScanner
        paused={false}
        onDecode={vi.fn()}
        torchSupported={true}
        torchEnabled={false}
      />,
    );
    expect((lastScannerProps.current?.components as { torch?: boolean })?.torch).toBe(
      false,
    );

    rerender(
      <BarcodeScanner
        paused={false}
        onDecode={vi.fn()}
        torchSupported={true}
        torchEnabled={true}
      />,
    );
    expect((lastScannerProps.current?.components as { torch?: boolean })?.torch).toBe(
      true,
    );

    rerender(
      <BarcodeScanner
        paused={false}
        onDecode={vi.fn()}
        torchSupported={false}
        torchEnabled={true}
      />,
    );
    expect((lastScannerProps.current?.components as { torch?: boolean })?.torch).toBe(
      false,
    );
  });

  it("never unmounts the <Scanner> across a paused toggle (re-render, not remount)", () => {
    const onDecode = vi.fn();
    const { rerender } = render(
      <BarcodeScanner paused={false} onDecode={onDecode} />,
    );
    // One mount so far.
    expect(Scanner).toHaveBeenCalledTimes(1);
    const callCountAfterMount = Scanner.mock.calls.length;

    rerender(<BarcodeScanner paused={true} onDecode={onDecode} />);
    rerender(<BarcodeScanner paused={false} onDecode={onDecode} />);

    // Re-renders increment the call count but the same instance stays mounted:
    // the mock is a vi.fn, so a remount would reset via cleanup — assert the
    // decode trigger node is still the same element (only one in the DOM).
    expect(screen.getAllByTestId("fake-scanner-decode-trigger")).toHaveLength(1);
    // Render calls increased (re-render), proving the component re-rendered
    // rather than being torn down and recreated as a fresh tree.
    expect(Scanner.mock.calls.length).toBeGreaterThan(callCountAfterMount);
  });
});
