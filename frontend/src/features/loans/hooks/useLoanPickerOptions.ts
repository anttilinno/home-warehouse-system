import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { inventoryApi } from "@/lib/api/inventory";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 8 Plan 03 — picker-options hook for the /loans/new form (LOAN-02).
// Mirrors the inventory form's usePickerOptions: two workspace-scoped reads
// (inventory entries + borrowers) fetched at limit=100, each mapped to a flat
// option array for a NATIVE RetroSelect (no type-ahead). An empty source list
// drives the disabled+hint state in the consuming form.
//
// The clamp to limit=100 is the 422-cap lesson (Phase 7 / 7b): the backend list
// handlers reject limit > 100, so both reads request EXACTLY 100.
//
// The inventory picker VALUE is the inventory ENTRY id (override 1 / Pitfall 1 —
// a loan posts inventory_id, never item_id). The LABEL resolves the owning
// item's name (joined from an items?limit=100 read, mirroring InventoryListPage)
// plus a qty/condition disambiguator. The optional `itemIdFilter` arg narrows
// the inventory options to entries whose item_id === itemIdFilter — the
// ?itemId= deep-link PRE-FILTERS the picker; it does NOT preselect/lock an item
// (override 1 / Pitfall 6).

export interface LoanPickerOption {
  id: string; // inventory entry id (the wire value) / borrower id
  label: string;
}

// Inventory option carries item_id so the form can auto-select / verify the
// ?itemId filter (the hook already narrows, but the form needs the linkage).
export interface InventoryLoanOption extends LoanPickerOption {
  item_id: string;
}

interface BorrowerRow {
  id: string;
  name?: string;
}
interface ItemRow {
  id: string;
  name: string;
}

const LIMIT = 100;

export interface LoanPickerOptions {
  inventoryOptions: InventoryLoanOption[];
  borrowerOptions: LoanPickerOption[];
  isLoading: boolean;
}

export function useLoanPickerOptions(
  itemIdFilter?: string,
): LoanPickerOptions {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const enabled = Boolean(wsId);

  // Inventory entries — the loan picker source. Full envelope; clamp to 100.
  const inventoryQuery = useQuery({
    queryKey: ["inventory", wsId as string, { limit: LIMIT }],
    queryFn: () =>
      inventoryApi.list(wsId as string, { limit: LIMIT }).then((r) => r.items),
    enabled,
  });

  // Item-name join (mirrors InventoryListPage) — the inventory entry carries no
  // embedded name, so resolve it from a limit=100 items read.
  const itemsQuery = useQuery({
    queryKey: ["items", wsId as string, { limit: LIMIT }],
    queryFn: () =>
      get<{ items: ItemRow[] }>(
        `/workspaces/${wsId}/items?limit=${LIMIT}`,
      ).then((r) => r.items),
    enabled,
  });

  // Borrowers — bare { items } envelope; clamp to 100.
  const borrowersQuery = useQuery({
    queryKey: ["borrowers", wsId as string, { limit: LIMIT }],
    queryFn: () =>
      get<{ items: BorrowerRow[] }>(
        `/workspaces/${wsId}/borrowers?limit=${LIMIT}`,
      ).then((r) => r.items),
    enabled,
  });

  const itemNameById = new Map<string, string>(
    (itemsQuery.data ?? []).map((i) => [i.id, i.name]),
  );

  const allInventory = inventoryQuery.data ?? [];
  const filtered = itemIdFilter
    ? allInventory.filter((e) => e.item_id === itemIdFilter)
    : allInventory;

  const inventoryOptions: InventoryLoanOption[] = filtered.map((e) => {
    const name = itemNameById.get(e.item_id) ?? e.item_id;
    // Disambiguator: qty + condition so two entries of the same item are
    // distinguishable in the native select.
    return {
      id: e.id,
      item_id: e.item_id,
      label: `${name} — qty ${e.quantity} · ${e.condition}`,
    };
  });

  const borrowerOptions: LoanPickerOption[] = (borrowersQuery.data ?? []).map(
    (b) => ({ id: b.id, label: b.name ?? b.id }),
  );

  return {
    inventoryOptions,
    borrowerOptions,
    isLoading:
      inventoryQuery.isLoading ||
      itemsQuery.isLoading ||
      borrowersQuery.isLoading,
  };
}
