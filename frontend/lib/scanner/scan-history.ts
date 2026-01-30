/**
 * Scan History Module
 *
 * Persists scan history to localStorage for quick access to recent scans.
 * Maintains a rolling list of the last 10 scans with timestamps.
 *
 * Features:
 * - Automatic de-duplication (same code moves to top)
 * - Size limit enforcement (max 10 entries)
 * - Graceful handling of localStorage errors
 */

import type { ScanHistoryEntry, EntityMatch } from "./types";

const SCAN_HISTORY_KEY = "hws-scan-history";
const MAX_HISTORY_SIZE = 10;

/**
 * Get all scan history entries.
 *
 * @returns Array of scan history entries, newest first
 */
export function getScanHistory(): ScanHistoryEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = localStorage.getItem(SCAN_HISTORY_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Validate entries have required fields
    return parsed.filter(
      (entry): entry is ScanHistoryEntry =>
        typeof entry === "object" &&
        typeof entry.code === "string" &&
        typeof entry.timestamp === "number"
    );
  } catch (error) {
    console.warn("[ScanHistory] Failed to read history:", error);
    return [];
  }
}

/**
 * Add a scan to the history.
 *
 * - Removes existing entry with same code (de-duplication)
 * - Adds new entry at the front
 * - Trims to MAX_HISTORY_SIZE
 *
 * @param entry - Scan entry without timestamp (will be added)
 */
export function addToScanHistory(
  entry: Omit<ScanHistoryEntry, "timestamp">
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const history = getScanHistory();

    // Create new entry with timestamp
    const newEntry: ScanHistoryEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    // Remove duplicate of same code if exists
    const filtered = history.filter((h) => h.code !== entry.code);

    // Add to front and limit size
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);

    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("[ScanHistory] Failed to save history:", error);
  }
}

/**
 * Create a history entry from an entity match result.
 *
 * @param code - The scanned code
 * @param format - The barcode format (e.g., 'qr_code', 'ean_13')
 * @param match - The entity match result from lookupByShortCode
 * @returns Partial entry ready for addToScanHistory
 */
export function createHistoryEntry(
  code: string,
  format: string,
  match: EntityMatch
): Omit<ScanHistoryEntry, "timestamp"> {
  if (match.type === "not_found") {
    return {
      code,
      format,
      entityType: "unknown",
    };
  }

  return {
    code,
    format,
    entityType: match.type,
    entityId: match.entity.id,
    entityName: match.entity.name,
  };
}

/**
 * Remove a specific entry from history by code.
 *
 * @param code - The code to remove
 */
export function removeFromScanHistory(code: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const history = getScanHistory();
    const filtered = history.filter((h) => h.code !== code);
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.warn("[ScanHistory] Failed to remove from history:", error);
  }
}

/**
 * Clear all scan history.
 */
export function clearScanHistory(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(SCAN_HISTORY_KEY);
  } catch (error) {
    console.warn("[ScanHistory] Failed to clear history:", error);
  }
}

/**
 * Get the most recent scan from history.
 *
 * @returns Most recent entry or undefined if history is empty
 */
export function getLastScan(): ScanHistoryEntry | undefined {
  const history = getScanHistory();
  return history[0];
}

/**
 * Format a timestamp for display.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted string like "2 min ago" or "Jan 15, 3:42 PM"
 */
export function formatScanTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffMin < 1) {
    return "Just now";
  }

  if (diffMin < 60) {
    return `${diffMin} min ago`;
  }

  if (diffHour < 24) {
    return `${diffHour} hr ago`;
  }

  // For older entries, show date/time
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
