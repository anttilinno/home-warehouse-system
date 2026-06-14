/**
 * Scan History Module
 *
 * Persists recent scans to localStorage under `hws-scan-history`. 1:1 parity
 * port of the legacy `frontend/lib/scanner/scan-history.ts`:
 *  - rolling list, newest first, capped at MAX_HISTORY_SIZE (10 — CONTEXT/
 *    UI-SPEC, roadmap ×10 over the legacy ×20 note);
 *  - de-duplication by `code` (re-scanning moves the entry to the top);
 *  - read-side validator drops malformed entries and NEVER throws on bad JSON
 *    (stale legacy data is safe — Runtime State Inventory / threat T-11-03).
 *
 * `updateScanHistory(code, item)` replaces the legacy `createHistoryEntry`
 * helper: after the resolve lookup settles, it refines the matched entry in
 * place with the resolved item id/name (or leaves it `unknown` on null).
 */

import type { Item } from "@/lib/types";
import type { ScanHistoryEntry } from "./types";

const SCAN_HISTORY_KEY = "hws-scan-history";
const MAX_HISTORY_SIZE = 10;

/**
 * All scan history entries, newest first. Returns `[]` (never throws) on
 * missing key, non-array payload, or malformed JSON; entries failing the shape
 * validator are filtered out (tolerant of stale legacy data — T-11-03).
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

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is ScanHistoryEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as ScanHistoryEntry).code === "string" &&
        typeof (entry as ScanHistoryEntry).timestamp === "number",
    );
  } catch {
    // Bad JSON / storage error → empty history (never throw on stale data).
    return [];
  }
}

/**
 * Add a scan to history. De-dupes by `code` (existing entry removed), prepends
 * the new entry with a fresh timestamp, and caps the list at 10
 * (`slice(0, 10)`). Storage failures are swallowed.
 */
export function addToScanHistory(
  entry: Omit<ScanHistoryEntry, "timestamp">,
): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const history = getScanHistory();

    const newEntry: ScanHistoryEntry = {
      ...entry,
      timestamp: Date.now(),
    };

    const filtered = history.filter((h) => h.code !== entry.code);
    const updated = [newEntry, ...filtered].slice(0, MAX_HISTORY_SIZE);

    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Quota / serialization failure — drop silently (history is best-effort).
  }
}

/**
 * Refine the history entry for `code` after the resolve lookup settles.
 *
 * - `item` present → mark the entry `entityType: 'item'` with id + name.
 * - `item` null    → mark the entry `entityType: 'unknown'` (clears any prior
 *   id/name from a stale resolve).
 *
 * No-op when no entry matches `code`. Preserves the entry's timestamp/position.
 */
export function updateScanHistory(code: string, item: Item | null): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const history = getScanHistory();
    let changed = false;

    const updated = history.map((h) => {
      if (h.code !== code) {
        return h;
      }
      changed = true;
      if (item) {
        return {
          ...h,
          entityType: "item" as const,
          entityId: item.id,
          entityName: item.name,
        };
      }
      return {
        ...h,
        entityType: "unknown" as const,
        entityId: undefined,
        entityName: undefined,
      };
    });

    if (changed) {
      localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(updated));
    }
  } catch {
    // Best-effort refinement — ignore storage errors.
  }
}

/** Remove a single entry by `code`. */
export function removeFromScanHistory(code: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const history = getScanHistory();
    const filtered = history.filter((h) => h.code !== code);
    localStorage.setItem(SCAN_HISTORY_KEY, JSON.stringify(filtered));
  } catch {
    // Ignore storage errors.
  }
}

/** Clear all scan history (removes the `hws-scan-history` key). */
export function clearScanHistory(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(SCAN_HISTORY_KEY);
  } catch {
    // Ignore storage errors.
  }
}

/** The most recent scan, or `undefined` when history is empty. */
export function getLastScan(): ScanHistoryEntry | undefined {
  return getScanHistory()[0];
}
