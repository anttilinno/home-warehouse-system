// Reusable Vitest mock for the Scanner component that the 3rd-party QR scanner
// library (installed as `@yudiel` + `react-qr-scanner` under its scoped name)
// publishes. Downstream tests install this mock via a vi.mock() bridge module:
//
//   vi.mock("<scanner-lib-specifier>", () => import("@/test/mocks/yudiel-scanner"));
//   import { triggerDecode, lastScannerProps, resetScannerMock } from "@/test/mocks/yudiel-scanner";
//
// This file must NOT import the real scanner library — we ARE the mock. The
// real specifier is deliberately NOT written out in this file so that a bare
// "grep for library specifier" check can confirm the no-import invariant.
import React from "react";
import { vi } from "vitest";

type ScannerProps = {
  onScan?: (codes: Array<{ rawValue: string; format: string }>) => void;
  onError?: (err: unknown) => void;
  paused?: boolean;
  formats?: string[];
  scanDelay?: number;
  allowMultiple?: boolean;
  sound?: boolean | string;
  components?: { torch?: boolean; finder?: boolean };
  constraints?: MediaTrackConstraints;
};

// Captures the most recent props the component was rendered with so tests can
// assert passthrough (e.g. that ScanPage forwarded `paused` or `formats`).
export const lastScannerProps: { current: ScannerProps } = { current: {} };

// A mock Scanner React component. Renders a button with data-testid so a
// DOM-centric test can dispatch a decode via userEvent.click(). For tests that
// do not use the DOM trigger, call `triggerDecode()` directly.
export const Scanner = vi.fn(function MockScanner(props: ScannerProps) {
  lastScannerProps.current = { ...props };
  return React.createElement(
    "button",
    {
      "data-testid": "fake-scanner-decode-trigger",
      type: "button",
      onClick: () =>
        !props.paused &&
        props.onScan?.([{ rawValue: "TEST-CODE-123", format: "qr_code" }]),
    },
    "MOCK SCANNER DECODE"
  );
});

// Helper that tests can call to trigger a decode from outside the DOM click path.
export function triggerDecode(
  rawValue: string = "TEST-CODE-123",
  format: string = "qr_code",
): void {
  lastScannerProps.current.onScan?.([{ rawValue, format }]);
}

// Helper that tests can call to simulate a Scanner error callback.
export function triggerScannerError(
  error: unknown = new Error("mock-scanner-error"),
): void {
  lastScannerProps.current.onError?.(error);
}

// The type-re-export the scanner library publishes. Tests that import
// IDetectedBarcode via the vi.mock shim are satisfied by this alias.
export type IDetectedBarcode = { rawValue: string; format: string };

// Reset helper — call in beforeEach to clear captured props and mock call history.
export function resetScannerMock(): void {
  lastScannerProps.current = {};
  (Scanner as unknown as { mockClear: () => void }).mockClear();
}
