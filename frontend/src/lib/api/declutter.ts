import { get, post } from "@/lib/api";

// Phase 14 Plan 04 (DECL-01/02) — typed declutterApi over api.ts, the single
// contract surface the declutter feature imports. Backend surface re-verified
// this planning session (declutter/handler.go + structs):
//   * GET  /declutter?threshold_days&group_by&page&limit → BARE { items, total }.
//     The rows live under `items` (handler.go:159) — NOT `changes`. group_by is
//     none|category|location; threshold_days default 90 (min 1); limit ≤ 100.
//   * GET  /declutter/counts → the unused_* / value_* summary (value_* are CENTS).
//   * POST /inventory/{inventory_id}/mark-used → { success, message }. Marks one
//     inventory row used. The path param is the INVENTORY row id (DeclutterItem.id),
//     NEVER item_id (T-14-13).

/** group_by control values accepted by GET /declutter. */
export type DeclutterGroupBy = "none" | "category" | "location";

/**
 * One unused-inventory analysis row. NOTE on identity (T-14-13): `id` is the
 * INVENTORY row id — this is the path param for mark-used. `item_id` is the
 * abstract item and is NEVER sent to mark-used.
 */
export interface DeclutterItem {
  id: string; // inventory row id (mark-used path param)
  item_id: string;
  item_name: string;
  item_sku: string;
  location_id: string;
  location_name: string;
  category_id?: string;
  category_name?: string;
  quantity: number;
  condition?: string;
  status?: string;
  purchase_price?: number; // CENTS (int64) — render via formatCents
  currency_code?: string | null; // may be null — guard before formatCents
  last_used_at?: string | null; // RFC3339 or null
  days_unused: number;
  score: number; // higher = declutter sooner
}

/** /declutter/counts summary header. value_* fields are CENTS (int64). */
export interface DeclutterCounts {
  unused_90: number;
  unused_180: number;
  unused_365: number;
  value_90: number;
  value_180: number;
  value_365: number;
}

export interface DeclutterListResponse {
  items: DeclutterItem[];
  total: number;
}

export interface DeclutterListOpts {
  thresholdDays?: number;
  groupBy?: DeclutterGroupBy;
  page?: number;
  limit?: number;
}

/** Build the query string from opts, omitting any unset param. */
function buildQuery(opts: DeclutterListOpts): string {
  const params = new URLSearchParams();
  if (opts.thresholdDays !== undefined) {
    params.set("threshold_days", String(opts.thresholdDays));
  }
  if (opts.groupBy !== undefined) {
    params.set("group_by", opts.groupBy);
  }
  if (opts.page !== undefined) {
    params.set("page", String(opts.page));
  }
  if (opts.limit !== undefined) {
    params.set("limit", String(opts.limit));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const declutterApi = {
  list(
    ws: string,
    opts: DeclutterListOpts = {},
  ): Promise<DeclutterListResponse> {
    return get<DeclutterListResponse>(
      `/workspaces/${ws}/declutter${buildQuery(opts)}`,
    );
  },

  counts(ws: string): Promise<DeclutterCounts> {
    return get<DeclutterCounts>(`/workspaces/${ws}/declutter/counts`);
  },

  // The path param is the INVENTORY row id (DeclutterItem.id), never item_id.
  markUsed(
    ws: string,
    inventoryId: string,
  ): Promise<{ success: boolean; message: string }> {
    return post<{ success: boolean; message: string }>(
      `/workspaces/${ws}/inventory/${inventoryId}/mark-used`,
    );
  },
};
