import { get, patch, post } from "@/lib/api";
import type {
  ExpiringEntry,
  Inventory,
  InventoryListResponse,
  InventoryStatus,
} from "@/lib/types";

// Phase 7b Plan 01 — typed inventoryApi over api.ts. Single typed boundary so
// feature plans never hand-roll fetch and never confuse the two response
// envelope shapes: GET /inventory carries the FULL { items, total, page,
// total_pages } envelope, while the scoped reads (by-item/…) return a BARE
// { items } that this module unwraps to a plain array (Pitfall 1). Inventory
// responses carry NO absolute URLs, so — unlike items.ts — there is NO
// toProxyUrl mapper and no mapItem-style mapper here.

// GET /inventory accepts ONLY page + limit (no server-side facet filter — any
// other facet is client-side or via the scoped reads, per 07b-RESEARCH).
export interface InventoryListParams {
  page?: number;
  limit?: number;
}

function buildQuery(params: InventoryListParams): string {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return qs.toString();
}

export const inventoryApi = {
  // Top-level list — the ONLY endpoint with the full pagination envelope.
  list(
    wsId: string,
    params: InventoryListParams,
  ): Promise<InventoryListResponse> {
    const qs = buildQuery(params);
    const suffix = qs ? `?${qs}` : "";
    return get<InventoryListResponse>(`/workspaces/${wsId}/inventory${suffix}`);
  },

  // Scoped read: BARE { items } (no total/page) — unwrap to Inventory[] so the
  // bare-envelope shape (Pitfall 1) is structurally distinct from list's
  // envelope (reading .total off the result is impossible by type).
  byItem(wsId: string, itemId: string): Promise<Inventory[]> {
    return get<{ items: Inventory[] }>(
      `/workspaces/${wsId}/inventory/by-item/${itemId}`,
    ).then((r) => r.items);
  },

  // Expiring projection — distinct shape: { items: ExpiringEntry[]; total }
  // with a YYYY-MM-DD `date` (NOT RFC3339 — Pitfall 4).
  expiring(
    wsId: string,
    days = 30,
  ): Promise<{ items: ExpiringEntry[]; total: number }> {
    return get<{ items: ExpiringEntry[]; total: number }>(
      `/workspaces/${wsId}/inventory/expiring?days=${days}`,
    );
  },

  // headers: optional 3rd arg so an offline-queued create can carry the
  // Idempotency-Key header (C-create mutationDefaults.ts) — same shape as
  // itemsApi.create.
  create(
    wsId: string,
    data: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<Inventory> {
    return post<Inventory>(`/workspaces/${wsId}/inventory`, data, headers);
  },

  // Full PATCH. Condition rides here; status does NOT (Pitfall 6 — status is
  // exclusively the dedicated /status route). The caller owns the body
  // (location_id + quantity + condition bundle); no default injection.
  update(
    wsId: string,
    id: string,
    data: Record<string, unknown>,
  ): Promise<Inventory> {
    return patch<Inventory>(`/workspaces/${wsId}/inventory/${id}`, data);
  },

  // Dedicated quantity route — allows quantity 0 (Pitfall 5), unlike create/
  // full-PATCH which enforce >= 1.
  updateQuantity(
    wsId: string,
    id: string,
    quantity: number,
  ): Promise<Inventory> {
    return patch<Inventory>(`/workspaces/${wsId}/inventory/${id}/quantity`, {
      quantity,
    });
  },

  // Dedicated status route — the ONLY way to change status.
  updateStatus(
    wsId: string,
    id: string,
    status: InventoryStatus,
  ): Promise<Inventory> {
    return patch<Inventory>(`/workspaces/${wsId}/inventory/${id}/status`, {
      status,
    });
  },

  // Whole-entry relocate — body is { location_id, container_id? } ONLY; NEVER a
  // quantity split (Pitfall 2). The full quantity moves; a movement row is
  // created server-side.
  move(
    wsId: string,
    id: string,
    location_id: string,
    container_id?: string,
  ): Promise<Inventory> {
    return post<Inventory>(`/workspaces/${wsId}/inventory/${id}/move`, {
      location_id,
      container_id,
    });
  },

  // Archive/restore return 204 (empty body — Pitfall 7).
  archive(wsId: string, id: string): Promise<void> {
    return post<void>(`/workspaces/${wsId}/inventory/${id}/archive`);
  },

  restore(wsId: string, id: string): Promise<void> {
    return post<void>(`/workspaces/${wsId}/inventory/${id}/restore`);
  },
};
