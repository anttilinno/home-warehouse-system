import { get } from "@/lib/api";
import type { Movement } from "@/lib/types";

// Phase 7b Plan 01 — typed movementsApi over api.ts. ALL three movement reads
// return a BARE { items } with NO pagination envelope, ever (Pitfall 1 /
// 07b-RESEARCH endpoint table rows 16-18); each method unwraps to Movement[].
// Movement rows are created ONLY by a move action (Pitfall 3) and emit NO SSE —
// callers manually invalidate ["movements", wsId] after a move mutation.

// Movement reads accept page + limit only.
export interface MovementListParams {
  page?: number;
  limit?: number;
}

function buildQuery(params?: MovementListParams): string {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  return qs.toString();
}

function suffix(params?: MovementListParams): string {
  const qs = buildQuery(params);
  return qs ? `?${qs}` : "";
}

export const movementsApi = {
  // Workspace-wide feed.
  workspace(wsId: string, params?: MovementListParams): Promise<Movement[]> {
    return get<{ items: Movement[] }>(
      `/workspaces/${wsId}/movements${suffix(params)}`,
    ).then((r) => r.items);
  },

  // Per-inventory history (the row-drawer scope).
  byInventory(
    wsId: string,
    invId: string,
    params?: MovementListParams,
  ): Promise<Movement[]> {
    return get<{ items: Movement[] }>(
      `/workspaces/${wsId}/inventory/${invId}/movements${suffix(params)}`,
    ).then((r) => r.items);
  },

  // Per-location history.
  byLocation(
    wsId: string,
    locId: string,
    params?: MovementListParams,
  ): Promise<Movement[]> {
    return get<{ items: Movement[] }>(
      `/workspaces/${wsId}/locations/${locId}/movements${suffix(params)}`,
    ).then((r) => r.items);
  },
};
