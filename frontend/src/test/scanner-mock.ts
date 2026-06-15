// Reusable Vitest mock for the third-party camera scanner component.
//
// Phase 11 (Scan) test infra. Every downstream scanner component/hook test
// installs this as the mock for the real scanner library via:
//
//   vi.mock("@yudiel/react-qr-scanner", () => import("@/test/scanner-mock"));
//   import { triggerDecode, lastScannerProps, resetScannerMock }
//     from "@/test/scanner-mock";
//
// This module re-implements the library's public prop surface (verified against
// node_modules/@yudiel/react-qr-scanner/dist/components/Scanner.d.ts):
//   onScan (required), onError, paused, formats, scanDelay, allowMultiple,
//   sound, components, constraints, styles, classNames, children.
// It renders a click-triggerable decode button AND exposes out-of-DOM trigger
// helpers so tests can fire onScan / onError without a real camera and without
// ever touching navigator.mediaDevices.getUserMedia.
//
// INVARIANT: this file must NOT `import`/`require` the real scanner library —
// we ARE the mock. (The only references to it here are in these comments;
// `grep -E "^(import|.*require\()" scanner-mock.ts | grep yudiel` → empty.)

import { createElement, type ReactNode } from "react";
import { vi } from "vitest";

// Mirrors the real library's IDetectedBarcode (the only fields consumers read).
export interface IDetectedBarcode {
  rawValue: string;
  format: string;
}

// Mirrors the real IScannerProps surface so vi.mock-satisfying imports type-check.
export interface ScannerProps {
  onScan: (detectedCodes: IDetectedBarcode[]) => void;
  onError?: (error: unknown) => void;
  paused?: boolean;
  formats?: string[];
  scanDelay?: number;
  allowMultiple?: boolean;
  sound?: boolean | string;
  components?: unknown;
  constraints?: MediaTrackConstraints;
  styles?: unknown;
  classNames?: unknown;
  children?: ReactNode;
}

// Ref-like handle so tests can assert prop passthrough (paused, formats, …).
export const lastScannerProps: { current: ScannerProps | null } = {
  current: null,
};

const TEST_TRIGGER_TESTID = "fake-scanner-decode-trigger";

/**
 * Fake Scanner component. Captures the latest props into `lastScannerProps` and
 * renders a single button (`data-testid="fake-scanner-decode-trigger"`) whose
 * click fires `onScan` with one decoded code. It NEVER calls getUserMedia.
 */
export const Scanner = vi.fn((props: ScannerProps) => {
  lastScannerProps.current = props;
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": TEST_TRIGGER_TESTID,
      onClick: () => {
        if (props.paused) return; // respect paused (matches the render-loop guard)
        props.onScan([{ rawValue: "TEST-CODE-123", format: "qr_code" }]);
      },
    },
    "scan",
  );
});

// Default export so `import Scanner from "..."` AND `import { Scanner }` both work.
export default Scanner;

/**
 * Test-facing: fire `onScan` from outside the DOM click path. Defaults match the
 * button's payload so click-driven and programmatic decodes are interchangeable.
 */
export function triggerDecode(
  rawValue = "TEST-CODE-123",
  format = "qr_code",
): void {
  lastScannerProps.current?.onScan([{ rawValue, format }]);
}

/** Test-facing: fire `onError` with a synthetic error (drives the ERROR banner). */
export function triggerScannerError(
  err: unknown = new Error("scan failed"),
): void {
  lastScannerProps.current?.onError?.(err);
}

/** Reset captured props + Scanner mock calls. Call in `beforeEach`. */
export function resetScannerMock(): void {
  lastScannerProps.current = null;
  Scanner.mockClear();
}
