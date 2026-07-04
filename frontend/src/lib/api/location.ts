import { get, post, patch, del } from "@/lib/api";

// Phase 10 Plan 01 — locationApi. MIRRORS lib/api/borrowers.ts structure. The
// envelope split is PER-ENDPOINT (Pitfall 2, verified location/handler.go
// 2026-06-13):
//   - LIST  GET /locations?page&limit → PAGINATED { items, total, page, total_pages }
//   - SEARCH GET /locations/search?q=&limit → BARE { items } (.then(r => r.items))
// limit is CLAMPED to 100 on every read (Pitfall 3: 422 over cap).
//
// FIELD-NAME PITFALL (Pitfall 6): locations nest via `parent_location` — NOT
// `parent_location_id`. The interface below types it so a typo is a compile
// error. Locations also carry an auto-generated `short_code`.

const MAX_LIMIT = 100;

// Backend LocationResponse — location/handler.go:374-384.
export interface Location {
  id: string;
  workspace_id: string;
  name: string;
  parent_location?: string; // ⚠ NOT parent_location_id (Pitfall 6)
  description?: string;
  short_code?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLocationBody {
  name: string; // required 1..255
  parent_location?: string; // omit (or empty) = root — ⚠ NOT _id
  description?: string;
  short_code?: string;
}

// All-optional PATCH (handler.go all-optional update).
export type UpdateLocationBody = Partial<CreateLocationBody>;

export const locationApi = {
  // PAGINATED { items, total, page, total_pages }. limit clamped to 100
  // (Pitfall 3). Tree fetches use limit=100; page-2+ is out of parity scope.
  list: (ws: string, page = 1, limit = 100) =>
    get<{
      items: Location[];
      total: number;
      page: number;
      total_pages: number;
    }>(
      `/workspaces/${ws}/locations?page=${page}&limit=${Math.min(limit, MAX_LIMIT)}`,
    ),
  // BARE { items } (Pitfall 2) — unwrap to Location[] for picker consumption.
  search: (ws: string, q: string, limit = 100) =>
    get<{ items: Location[] }>(
      `/workspaces/${ws}/locations/search?q=${encodeURIComponent(q)}&limit=${Math.min(
        limit,
        MAX_LIMIT,
      )}`,
    ).then((r) => r.items),
  get: (ws: string, id: string) =>
    get<Location>(`/workspaces/${ws}/locations/${id}`),
  // headers: optional 3rd arg so offline-queued creates can carry the
  // Idempotency-Key header (Phase 3b mutationDefaults.ts).
  create: (
    ws: string,
    body: CreateLocationBody,
    headers?: Record<string, string>,
  ) => post<Location>(`/workspaces/${ws}/locations`, body, headers),
  update: (ws: string, id: string, body: UpdateLocationBody) =>
    patch<Location>(`/workspaces/${ws}/locations/${id}`, body),
  archive: (ws: string, id: string) =>
    post<void>(`/workspaces/${ws}/locations/${id}/archive`),
  restore: (ws: string, id: string) =>
    post<void>(`/workspaces/${ws}/locations/${id}/restore`),
  del: (ws: string, id: string) =>
    del<void>(`/workspaces/${ws}/locations/${id}`),
};
