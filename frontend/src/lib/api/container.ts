import { get, post, patch, del } from "@/lib/api";

// Phase 10 Plan 01 — containerApi. MIRRORS lib/api/borrowers.ts structure. The
// envelope split is PER-ENDPOINT (Pitfall 2, verified container/handler.go
// 2026-06-13):
//   - LIST  GET /containers?page&limit → PAGINATED { items, total, page, total_pages }
//   - SEARCH GET /containers/search?q=&limit → BARE { items } (.then(r => r.items))
// limit is CLAMPED to 100 on every read (Pitfall 3: 422 over cap).
//
// Containers are FLAT — they reference a single `location_id` (TAX-05's
// "grouped by location" is a CLIENT group-by, not a tree). They also carry
// `short_code` and an optional `capacity`.

const MAX_LIMIT = 100;

// Backend ContainerResponse — container/handler.go:355-366.
export interface Container {
  id: string;
  workspace_id: string;
  name: string;
  location_id: string;
  description?: string;
  capacity?: number;
  short_code?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateContainerBody {
  name: string; // required 1..255
  location_id: string; // required
  description?: string;
  capacity?: number;
  short_code?: string;
}

// All-optional PATCH (handler.go all-optional update).
export type UpdateContainerBody = Partial<CreateContainerBody>;

export const containerApi = {
  // PAGINATED { items, total, page, total_pages }. limit clamped to 100
  // (Pitfall 3).
  list: (ws: string, page = 1, limit = 100) =>
    get<{
      items: Container[];
      total: number;
      page: number;
      total_pages: number;
    }>(
      `/workspaces/${ws}/containers?page=${page}&limit=${Math.min(limit, MAX_LIMIT)}`,
    ),
  // BARE { items } (Pitfall 2) — unwrap to Container[] for picker consumption.
  search: (ws: string, q: string, limit = 100) =>
    get<{ items: Container[] }>(
      `/workspaces/${ws}/containers/search?q=${encodeURIComponent(q)}&limit=${Math.min(
        limit,
        MAX_LIMIT,
      )}`,
    ).then((r) => r.items),
  get: (ws: string, id: string) =>
    get<Container>(`/workspaces/${ws}/containers/${id}`),
  // headers: optional 3rd arg so offline-queued creates can carry the
  // Idempotency-Key header (Phase 3b mutationDefaults.ts).
  create: (
    ws: string,
    body: CreateContainerBody,
    headers?: Record<string, string>,
  ) => post<Container>(`/workspaces/${ws}/containers`, body, headers),
  update: (ws: string, id: string, body: UpdateContainerBody) =>
    patch<Container>(`/workspaces/${ws}/containers/${id}`, body),
  archive: (ws: string, id: string) =>
    post<void>(`/workspaces/${ws}/containers/${id}/archive`),
  restore: (ws: string, id: string) =>
    post<void>(`/workspaces/${ws}/containers/${id}/restore`),
  del: (ws: string, id: string) =>
    del<void>(`/workspaces/${ws}/containers/${id}`),
};
