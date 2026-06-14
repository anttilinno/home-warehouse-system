/**
 * useScanHistory — a React wrapper over `lib/scanner/scan-history` (SCAN-06).
 *
 * State-backed (NOT a re-read every render — render-loop guard): the entries are
 * held in `useState`, seeded once from `getScanHistory()` on mount, and re-read
 * from localStorage only AFTER a mutation (add / clear). This keeps the array
 * reference stable across no-op renders so consumers (and any effect that lists
 * `entries` as a dep) do not loop.
 *
 * `refire(entry)` returns the stored `{ code, format }` for the component to
 * hand to `useScanResolve.handleResolveCode` — a history re-tap funnels through
 * the SAME path as a live scan (binding override 7 / RESEARCH Pattern 3). This
 * hook deliberately does NOT call the funnel itself; the ScanPage wires them.
 */

import { useCallback, useState } from "react";
import {
  addToScanHistory,
  clearScanHistory,
  getScanHistory,
  type ScanHistoryEntry,
} from "@/lib/scanner";

export interface UseScanHistoryResult {
  /** History entries, newest first (snapshot; refreshed after mutations). */
  entries: ScanHistoryEntry[];
  /** Persist a new scan then refresh the snapshot. */
  add: (entry: Omit<ScanHistoryEntry, "timestamp">) => void;
  /** Clear all history then refresh the snapshot. */
  clear: () => void;
  /** Return the `{ code, format }` to re-funnel through handleResolveCode. */
  refire: (entry: ScanHistoryEntry) => { code: string; format: string };
}

export function useScanHistory(): UseScanHistoryResult {
  // Seed once from storage; lazy initializer so getScanHistory runs a single
  // time at mount, not on every render.
  const [entries, setEntries] = useState<ScanHistoryEntry[]>(getScanHistory);

  const add = useCallback((entry: Omit<ScanHistoryEntry, "timestamp">) => {
    addToScanHistory(entry);
    setEntries(getScanHistory());
  }, []);

  const clear = useCallback(() => {
    clearScanHistory();
    setEntries(getScanHistory());
  }, []);

  const refire = useCallback(
    (entry: ScanHistoryEntry) => ({ code: entry.code, format: entry.format }),
    [],
  );

  return { entries, add, clear, refire };
}
