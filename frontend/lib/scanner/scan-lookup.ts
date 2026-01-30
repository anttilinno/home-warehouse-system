/**
 * Scan Lookup Module
 *
 * Looks up scanned codes against IndexedDB to identify matching entities.
 * Searches items, containers, and locations by their short_code field.
 * Also checks item barcode field for UPC/EAN matches.
 *
 * Uses parallel queries for performance.
 */

import { getAll } from "@/lib/db/offline-db";
import type { Item } from "@/lib/types/items";
import type { Container } from "@/lib/types/containers";
import type { Location } from "@/lib/types/locations";
import type { EntityMatch } from "./types";

/**
 * Look up a scanned code in IndexedDB.
 *
 * Search order:
 * 1. Items by short_code (exact match)
 * 2. Containers by short_code (exact match)
 * 3. Locations by short_code (exact match)
 * 4. Items by barcode field (exact match for UPC/EAN)
 *
 * @param code - The scanned barcode/QR code value
 * @returns EntityMatch with found entity or not_found result
 */
export async function lookupByShortCode(code: string): Promise<EntityMatch> {
  if (!code || code.trim().length === 0) {
    return { type: "not_found", code: "" };
  }

  const trimmedCode = code.trim();

  try {
    // Parallel fetch all entities from IndexedDB
    const [items, containers, locations] = await Promise.all([
      getAll<Item>("items"),
      getAll<Container>("containers"),
      getAll<Location>("locations"),
    ]);

    // Search items by short_code first (case-insensitive)
    const itemByShortCode = items.find(
      (item) =>
        item.short_code?.toLowerCase() === trimmedCode.toLowerCase()
    );
    if (itemByShortCode) {
      return { type: "item", entity: itemByShortCode };
    }

    // Search containers by short_code
    const containerByShortCode = containers.find(
      (container) =>
        container.short_code?.toLowerCase() === trimmedCode.toLowerCase()
    );
    if (containerByShortCode) {
      return { type: "container", entity: containerByShortCode };
    }

    // Search locations by short_code
    const locationByShortCode = locations.find(
      (location) =>
        location.short_code?.toLowerCase() === trimmedCode.toLowerCase()
    );
    if (locationByShortCode) {
      return { type: "location", entity: locationByShortCode };
    }

    // Fallback: search items by barcode field (for UPC/EAN barcodes)
    const itemByBarcode = items.find(
      (item) =>
        item.barcode?.toLowerCase() === trimmedCode.toLowerCase()
    );
    if (itemByBarcode) {
      return { type: "item", entity: itemByBarcode };
    }

    // Not found
    return { type: "not_found", code: trimmedCode };
  } catch (error) {
    console.error("[ScanLookup] Failed to query IndexedDB:", error);
    // Return not_found on error rather than throwing
    return { type: "not_found", code: trimmedCode };
  }
}

/**
 * Get the display name for an entity match.
 *
 * @param match - The entity match result
 * @returns Display name or the scanned code for not_found
 */
export function getEntityDisplayName(match: EntityMatch): string {
  if (match.type === "not_found") {
    return match.code;
  }
  return match.entity.name;
}

/**
 * Get the navigation URL for an entity match.
 *
 * @param match - The entity match result
 * @returns Dashboard URL for the entity detail page
 */
export function getEntityUrl(match: EntityMatch): string | null {
  switch (match.type) {
    case "item":
      return `/dashboard/items/${match.entity.id}`;
    case "container":
      return `/dashboard/containers?selected=${match.entity.id}`;
    case "location":
      return `/dashboard/locations?selected=${match.entity.id}`;
    case "not_found":
      return null;
  }
}
