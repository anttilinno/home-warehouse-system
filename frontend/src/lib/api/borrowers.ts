import { get, post, patch, del } from "@/lib/api";

// Phase 9 Plan 01 — borrowersApi. MIRRORS lib/api/loans.ts: list endpoints
// return a BARE { items } envelope (handler.go:286-288, 350-352 — verified
// 2026-06-13), NEVER a { items, total } pager (Pitfall 1: reading `.total` must
// be a TYPE error). Single-entity routes return a decorated Borrower.
//
// The default list/search limit is 100 and is CLAMPED to 100 — the backend caps
// limit at 100 and returns 422 when exceeded (Pitfall 2). The /borrowers/search
// route exists for forward-compat / pickers; the list page does NOT call it
// (OQ2 / binding override — list uses client search over a single ≤100 fetch).

const MAX_LIMIT = 100;

// Backend BorrowerResponse — handler.go:325-336. email/phone/notes optional.
export interface Borrower {
  id: string;
  workspace_id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBorrowerBody {
  name: string; // required 1..255
  email?: string; // format:email (omit when empty)
  phone?: string;
  notes?: string;
}

// All-optional PATCH (handler.go all-optional update).
export type UpdateBorrowerBody = Partial<CreateBorrowerBody>;

export const borrowersApi = {
  // BARE { items } — no total (Pitfall 1). limit clamped to 100 (Pitfall 2).
  list: (ws: string, page = 1, limit = 100) =>
    get<{ items: Borrower[] }>(
      `/workspaces/${ws}/borrowers?page=${page}&limit=${Math.min(limit, MAX_LIMIT)}`,
    ),
  // Present for forward-compat / pickers; the list page does NOT use this (OQ2).
  search: (ws: string, q: string, limit = 100) =>
    get<{ items: Borrower[] }>(
      `/workspaces/${ws}/borrowers/search?q=${encodeURIComponent(q)}&limit=${Math.min(
        limit,
        MAX_LIMIT,
      )}`,
    ).then((r) => r.items),
  get: (ws: string, id: string) =>
    get<Borrower>(`/workspaces/${ws}/borrowers/${id}`),
  create: (ws: string, body: CreateBorrowerBody) =>
    post<Borrower>(`/workspaces/${ws}/borrowers`, body),
  update: (ws: string, id: string, body: UpdateBorrowerBody) =>
    patch<Borrower>(`/workspaces/${ws}/borrowers/${id}`, body),
  del: (ws: string, id: string) =>
    del<void>(`/workspaces/${ws}/borrowers/${id}`),
};
