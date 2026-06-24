import { useMemo, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/lib/api/settings";
import type { Condition, Inventory, InventoryStatus } from "@/lib/types";
import { CONDITION_LABEL, STATUS_LABEL } from "../inventoryEnums";

// Phase 7b refactor — the client-side filter/sort machine for the inventory list
// (INV-01 R1: the list endpoint has NO server filter params, so search + status
// + condition + sort are all client state applied to the loaded page).
// Extracted from InventoryListPage to drop that component's cyclomatic load.
// `itemName` is injected so the search predicate can match on the joined item
// name. Archived visibility is NO longer a per-page facet — it reads from the
// global, backend-synced `show_archived` user preference (shared ["me"] query),
// toggled on Settings → Data & Storage.

// Client-side sortable columns (the loaded page only — the endpoint can't sort).
export type SortKey = "qty" | "status" | "condition";

export interface FilterChip {
  key: string;
  label: string;
  displayValue: string;
}

export function useInventoryFilters(
  entries: Inventory[],
  itemName: (id: string) => string | undefined,
) {
  const { t } = useLingui();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InventoryStatus[]>([]);
  const [conditionFilter, setConditionFilter] = useState<Condition[]>([]);
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
    const q = search.trim().toLowerCase();
    let rows = entries.filter((e) => {
      if (!showArchived && e.is_archived) return false;
      if (statusFilter.length && !statusFilter.includes(e.status)) return false;
      if (conditionFilter.length && !conditionFilter.includes(e.condition))
        return false;
      if (q) {
        const name = (itemName(e.item_id) ?? "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        let av: string | number;
        let bv: string | number;
        if (sortKey === "qty") {
          av = a.quantity;
          bv = b.quantity;
        } else {
          av = a[sortKey];
          bv = b[sortKey];
        }
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return rows;
  }, [
    entries,
    search,
    statusFilter,
    conditionFilter,
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
    !!search || statusFilter.length > 0 || conditionFilter.length > 0;

  function clearAllFilters() {
    setSearch("");
    setStatusFilter([]);
    setConditionFilter([]);
  }

  const filterChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (statusFilter.length)
      chips.push({
        key: "status",
        label: t`Status`,
        displayValue: statusFilter.map((s) => STATUS_LABEL[s]).join(", "),
      });
    if (conditionFilter.length)
      chips.push({
        key: "condition",
        label: t`Condition`,
        displayValue: conditionFilter.map((c) => CONDITION_LABEL[c]).join(", "),
      });
    return chips;
  }, [statusFilter, conditionFilter, t]);

  function removeFilter(key: string) {
    if (key === "status") setStatusFilter([]);
    else if (key === "condition") setConditionFilter([]);
  }

  return {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    conditionFilter,
    setConditionFilter,
    visible,
    onSort,
    sortGlyph,
    hasFilters,
    clearAllFilters,
    filterChips,
    removeFilter,
  };
}
