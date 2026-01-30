/**
 * Scanner Types
 *
 * Type definitions for barcode scanning functionality.
 */

import type { Item } from "@/lib/types/items";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";

/**
 * Result of looking up a scanned code in IndexedDB.
 */
export type EntityMatch =
  | { type: "item"; entity: Item }
  | { type: "container"; entity: Container }
  | { type: "location"; entity: Location }
  | { type: "not_found"; code: string };

/**
 * Entry in the scan history stored in localStorage.
 */
export interface ScanHistoryEntry {
  /** The raw scanned code value */
  code: string;
  /** Barcode format (qr_code, ean_13, etc) */
  format: string;
  /** Entity type if found, 'unknown' otherwise */
  entityType: "item" | "container" | "location" | "unknown";
  /** Entity ID if found */
  entityId?: string;
  /** Entity name for display */
  entityName?: string;
  /** Unix timestamp of scan */
  timestamp: number;
}

/**
 * Supported barcode formats for scanning.
 * Based on Barcode Detection API format strings.
 */
export const SUPPORTED_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
] as const;

export type BarcodeFormat = (typeof SUPPORTED_FORMATS)[number];
