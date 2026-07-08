import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { matchesFragments } from "@/components/retro";
import { settingsApi } from "@/lib/api/settings";
import type { Condition, Inventory, InventoryStatus } from "@/lib/types";

// Phase 7b refactor, revised for design 1c — the client-side filter/sort machine
// for the inventory list (INV-01 R1: the list endpoint has NO server filter
// params, so status + condition + search + sort are all applied to the loaded
// page). Status/condition/search now come from the URL (design 1c ViewBar);
// this hook keeps only the client SORT state and applies the composed filter.
// `itemName` is injected so the search predicate can match the joined item name.
// Archived visibility reads from the global, backend-synced `show_archived`
// user preference (shared ["me"] query), toggled on Settings → Data & Storage.

// Client-side sortable columns (the loaded page only — the endpoint can't sort).
export type SortKey = "qty" | "status" | "condition";

export interface UseInventoryVisibleInput {
  /** Selected statuses (URL-backed; empty = all). */
  statusFilter: InventoryStatus[];
  /** Selected conditions (URL-backed; empty = all). */
  conditionFilter: Condition[];
  /** Live query + committed search terms (searchMatch fragments). */
  fragments: string[];
}

export function useInventoryVisible(
  entries: Inventory[],
  itemName: (id: string) => string | undefined,
  { statusFilter, conditionFilter, fragments }: UseInventoryVisibleInput,
) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Archived visibility is the global, backend-synced user preference (shared
  // ["me"] query), NOT a per-page facet — toggled on Settings → Data & Storage.
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => settingsApi.getMe(),
  });
  const showArchived = me.data?.show_archived ?? false;

  // Apply client filters + sort to the loaded page.
  const visible = useMemo(() => {
    let rows = entries.filter((e) => {
      if (!showArchived && e.is_archived) return false;
      if (statusFilter.length && !statusFilter.includes(e.status)) return false;
      if (conditionFilter.length && !conditionFilter.includes(e.condition))
        return false;
      return matchesFragments([itemName(e.item_id)], fragments);
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const av = sortKey === "qty" ? a.quantity : a[sortKey];
        const bv = sortKey === "qty" ? b.quantity : b[sortKey];
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return rows;
  }, [
    entries,
    statusFilter,
    conditionFilter,
    fragments,
    showArchived,
    sortKey,
    sortDir,
    itemName,
  ]);

  function onSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }
  function sortGlyph(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  const hasFilters =
    fragments.length > 0 ||
    statusFilter.length > 0 ||
    conditionFilter.length > 0;

  return { visible, onSort, sortGlyph, hasFilters };
}
