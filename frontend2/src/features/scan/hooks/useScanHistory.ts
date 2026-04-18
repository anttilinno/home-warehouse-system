// frontend2/src/features/scan/hooks/useScanHistory.ts
//
// Single React API surface for scan history (Phase 64 D-04). Components MUST
// NOT import from `@/lib/scanner` for history reads/writes — they consume this
// hook, which normalizes the React-state sync around the module-scope
// persistence store.
//
// Cross-tab consistency: subscribes to `window.storage` so a write from
// another tab (or from a legacy `/frontend` instance sharing the same origin)
// re-hydrates this tab's local state.
import { useCallback, useEffect, useState } from "react";
import {
  getScanHistory,
  addToScanHistory,
  removeFromScanHistory,
  clearScanHistory,
  type ScanHistoryEntry,
} from "@/lib/scanner";

export function useScanHistory() {
  const [entries, setEntries] = useState<ScanHistoryEntry[]>([]);

  useEffect(() => {
    setEntries(getScanHistory());
    // Cross-tab sync: another tab or a /frontend write triggers a storage event.
    const onStorage = () => setEntries(getScanHistory());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((e: Omit<ScanHistoryEntry, "timestamp">) => {
    addToScanHistory(e);
    setEntries(getScanHistory());
  }, []);

  const remove = useCallback((code: string) => {
    removeFromScanHistory(code);
    setEntries(getScanHistory());
  }, []);

  const clear = useCallback(() => {
    clearScanHistory();
    setEntries([]);
  }, []);

  return { entries, add, clear, remove };
}
