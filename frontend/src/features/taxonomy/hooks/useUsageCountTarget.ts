import { useCallback, useState } from "react";
import { useUsageCount, type UsageKind } from "./useUsageCount";

// Phase 10 TAX refactor — the destructive-dialog target state shared by the
// Categories archive (TAX-02) and Containers delete (TAX-06) flows. Both opened
// a confirm immediately with count=null ("still loading"), then fetched the
// assigned-item count via useUsageCount and patched the SAME target so the copy
// becomes count-aware — guarding every setState with `prev?.id === id` so a
// late-arriving count for a since-closed/swapped dialog is dropped. On a count
// read failure both fall back to the plain (zero) confirm. This extracts that
// open/fetch/patch/clear cycle verbatim.

export interface UsageCountTarget {
  id: string;
  name: string;
  count: number | null; // null = still loading
}

/**
 * Manages a single destructive-dialog target whose assigned-item count is
 * fetched on open. `open(id, name)` shows the target with count=null then
 * resolves the count (failures fall back to 0); `clear()` dismisses it.
 */
export function useUsageCountTarget(kind: UsageKind) {
  const { fetchCount } = useUsageCount();
  const [target, setTarget] = useState<UsageCountTarget | null>(null);

  const open = useCallback(
    (id: string, name: string) => {
      setTarget({ id, name, count: null });
      const patch = (count: number) =>
        setTarget((prev) => (prev?.id === id ? { ...prev, count } : prev));
      fetchCount(kind, id)
        .then(patch)
        // On a count read failure, fall back to the plain (zero) confirm — the
        // archive/delete proceeds either way (advisory warning only).
        .catch(() => patch(0));
    },
    [fetchCount, kind],
  );

  const clear = useCallback(() => setTarget(null), []);

  return { target, open, clear };
}
