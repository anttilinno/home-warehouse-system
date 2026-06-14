import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Phase 7b Plan 03 — picker-options hook for the inventory entry form + move
// dialog. Three workspace-scoped reads (items / locations / containers) fetched
// once at limit=100, each mapped to a flat { id, label }[] option array.
//
// The form/move-dialog pickers are NATIVE RetroSelects (CONTEXT locked): no
// type-ahead, no free-typing. An empty source list drives the disabled+hint
// state in the consuming component.
//
// These three read endpoints live OUTSIDE inventoryApi (they belong to the
// items/locations/containers domains), so this hook calls the generic `get`
// boundary directly with the paginated-envelope shape each returns.

export interface PickerOption {
  id: string;
  label: string;
}

// Minimal row shapes — only the fields the option label needs.
interface ItemRow {
  id: string;
  name: string;
  sku?: string;
}
interface NamedRow {
  id: string;
  name?: string;
}

const LIMIT = 100;

export interface PickerOptions {
  items: PickerOption[];
  locations: PickerOption[];
  containers: PickerOption[];
  isLoading: boolean;
}

export function usePickerOptions(): PickerOptions {
  const { currentWorkspaceId: wsId } = useWorkspace();
  const enabled = Boolean(wsId);

  const itemsQuery = useQuery({
    queryKey: ["items", wsId as string, { limit: LIMIT }],
    queryFn: () =>
      get<{ items: ItemRow[] }>(
        `/workspaces/${wsId}/items?limit=${LIMIT}`,
      ).then((r) => r.items),
    enabled,
  });

  const locationsQuery = useQuery({
    queryKey: ["locations", wsId as string, { limit: LIMIT }],
    queryFn: () =>
      get<{ items: NamedRow[] }>(
        `/workspaces/${wsId}/locations?limit=${LIMIT}`,
      ).then((r) => r.items),
    enabled,
  });

  const containersQuery = useQuery({
    queryKey: ["containers", wsId as string, { limit: LIMIT }],
    queryFn: () =>
      get<{ items: NamedRow[] }>(
        `/workspaces/${wsId}/containers?limit=${LIMIT}`,
      ).then((r) => r.items),
    enabled,
  });

  const items: PickerOption[] = (itemsQuery.data ?? []).map((r) => ({
    id: r.id,
    // Append the SKU as a disambiguator when present (e.g. "Cordless Drill — SKU-1").
    label: r.sku ? `${r.name} — ${r.sku}` : r.name,
  }));

  const locations: PickerOption[] = (locationsQuery.data ?? []).map((r) => ({
    id: r.id,
    label: r.name ?? r.id,
  }));

  const containers: PickerOption[] = (containersQuery.data ?? []).map((r) => ({
    id: r.id,
    label: r.name ?? r.id,
  }));

  return {
    items,
    locations,
    containers,
    isLoading:
      itemsQuery.isLoading ||
      locationsQuery.isLoading ||
      containersQuery.isLoading,
  };
}
