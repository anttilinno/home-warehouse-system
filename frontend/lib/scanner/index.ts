/**
 * Scanner Module
 *
 * Barcode and QR code scanning utilities for the Home Warehouse System.
 *
 * @example
 * ```typescript
 * import {
 *   initBarcodePolyfill,
 *   lookupByShortCode,
 *   addToScanHistory,
 *   triggerScanFeedback,
 * } from "@/lib/scanner";
 *
 * // Initialize polyfill on app load
 * await initBarcodePolyfill();
 *
 * // On scan success
 * const match = await lookupByShortCode(scannedCode);
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
  playBeep,
  playSuccessBeep,
  playErrorBeep,
  triggerHaptic,
  triggerScanFeedback,
} from "./feedback";

// Lookup
export {
  lookupByShortCode,
  getEntityDisplayName,
  getEntityUrl,
} from "./scan-lookup";

// History
export {
  getScanHistory,
  addToScanHistory,
  createHistoryEntry,
  removeFromScanHistory,
  clearScanHistory,
  getLastScan,
  formatScanTime,
} from "./scan-history";
