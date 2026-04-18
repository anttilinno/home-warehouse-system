/**
 * Scanner Module
 *
 * Barcode and QR code scanning utilities for the Home Warehouse System.
 *
 * Phase 64 surface only — no `scan-lookup` export (deferred to Phase 65).
 *
 * @example
 * ```typescript
 * import {
 *   initBarcodePolyfill,
 *   addToScanHistory,
 *   triggerScanFeedback,
 * } from "@/lib/scanner";
 *
 * // Initialize polyfill on app load
 * await initBarcodePolyfill();
 *
 * // On scan success
 * triggerScanFeedback();
 * addToScanHistory(createHistoryEntry(scannedCode, "qr_code", match));
 * ```
 */

// Types
export type { EntityMatch, ScanHistoryEntry, BarcodeFormat } from "./types";
export { SUPPORTED_FORMATS } from "./types";

// Polyfill
export { initBarcodePolyfill, isBarcodeDetectionAvailable } from "./init-polyfill";

// Feedback
export {
  initAudioContext,
  resumeAudioContext,
  playBeep,
  playSuccessBeep,
  playErrorBeep,
  triggerHaptic,
  triggerScanFeedback,
} from "./feedback";
