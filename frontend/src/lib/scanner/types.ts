/**
 * Scanner Types
 *
 * Type definitions for barcode scanning. 1:1 parity port of the legacy
 * `frontend/lib/scanner/types.ts`, trimmed to the v3.0 surface:
 *  - SUPPORTED_FORMATS is the SCAN-02 four-format SUBSET (binding override 3 in
 *    11-02-PLAN): qr_code / upc_a / ean_13 / code_128. The legacy file also
 *    enabled ean_8 + upc_e; v3.0 deliberately narrows to the four CONTEXT locks.
 *  - `BarcodeFormat` is re-exported from `barcode-detector` (the canonical enum
 *    that the scanner lib consumes), NOT derived from the local tuple — so
 *    downstream code shares one source of truth for format strings.
 *  - The legacy `EntityMatch` union (item/container/location) is dropped: it
 *    depended on legacy entity types that do not exist in frontend2, and the
 *    v3.0 resolve funnel keys off `entityType: 'item' | 'unknown'` instead.
 */

import type { BarcodeFormat } from "barcode-detector";

// Re-export so consumers can `import { BarcodeFormat } from "@/lib/scanner"`.
export type { BarcodeFormat };

/**
 * Supported barcode formats for scanning (SCAN-02 subset).
 *
 * EXACTLY the four formats CONTEXT/SCAN-02 lock for parity with the live-scan
 * `<Scanner formats={...}>` prop — these are the lowercase enum strings the
 * lib expects on its `formats` prop (NOT `enabledFormats`).
 */
export const SUPPORTED_FORMATS = [
  "qr_code",
  "upc_a",
  "ean_13",
  "code_128",
] as const;

/** A format string from the supported subset above. */
export type SupportedFormat = (typeof SUPPORTED_FORMATS)[number];

/**
 * Entry in the scan history stored in localStorage under `hws-scan-history`.
 *
 * Shape is identical to the legacy `/frontend` entry so stale legacy data is
 * readable after the v3.0 rebuild (Runtime State Inventory): the validator in
 * scan-history.ts filters any entry that does not match this shape.
 */
export interface ScanHistoryEntry {
  /** The raw scanned code value. */
  code: string;
  /** Barcode format (qr_code, ean_13, manual, history, …). */
  format: string;
  /** Entity type if resolved, 'unknown' otherwise. */
  entityType: "item" | "unknown";
  /** Entity ID if resolved. */
  entityId?: string;
  /** Entity name for display. */
  entityName?: string;
  /** Unix timestamp (ms) of the scan. */
  timestamp: number;
}
