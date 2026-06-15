import { get, post, patch } from "@/lib/api";
import type { Loan } from "@/lib/types";

// Phase 8 Plan 01 — loan lifecycle create body. Field is `inventory_id`, NEVER
// `item_id` (Pitfall 1 / override 1): a loan is taken against a specific stocked
// inventory entry, not the abstract item. Verified from loan/handler.go +
// live curl 2026-06-13.
export interface CreateLoanBody {
  inventory_id: string; // NOT item_id (Pitfall 1)
  borrower_id: string;
  quantity: number; // minimum 1
  loaned_at?: string; // RFC3339; defaults to now server-side
  due_date?: string; // RFC3339
  notes?: string; // maxLength 1000
}

// Phase 7 Plan 01 — read-only per-item loans. There is no separate "active loan"
// endpoint; GET /items/{itemId}/loans returns ALL loans, partitioned client-side
// on is_active (07-RESEARCH Open Q2). Embedded item.primary_photo_thumbnail_url
// is absolute on the wire but is NOT rewritten here — loan panels render the
// borrower/dates, not that thumbnail; if a future panel renders it, rewrite at
// that consumer. (Kept minimal to avoid speculative mapping.)

export interface PartitionedLoans {
  active: Loan[];
  history: Loan[];
}

export const loansApi = {
  byItem(wsId: string, itemId: string): Promise<PartitionedLoans> {
    return get<{ items: Loan[] }>(
      `/workspaces/${wsId}/items/${itemId}/loans`,
    ).then((res) => {
      const active: Loan[] = [];
      const history: Loan[] = [];
      for (const loan of res.items) {
        (loan.is_active ? active : history).push(loan);
      }
      return { active, history };
    });
  },

  // Phase 8 Plan 01 — full lifecycle surface (08-RESEARCH "loansApi extension",
  // verified live 2026-06-13). Lists return BARE { items } envelopes (huma's
  // `$schema` key is deliberately NOT modelled — Pitfall 4); single-entity
  // routes return a decorated Loan.
  list: (ws: string, page = 1, limit = 50) =>
    get<{ items: Loan[] }>(
      `/workspaces/${ws}/loans?page=${page}&limit=${limit}`,
    ),
  active: (ws: string) =>
    get<{ items: Loan[] }>(`/workspaces/${ws}/loans/active`),
  overdue: (ws: string) =>
    get<{ items: Loan[] }>(`/workspaces/${ws}/loans/overdue`),
  get: (ws: string, id: string) => get<Loan>(`/workspaces/${ws}/loans/${id}`),
  create: (ws: string, body: CreateLoanBody) =>
    post<Loan>(`/workspaces/${ws}/loans`, body),
  return: (ws: string, id: string) =>
    post<Loan>(`/workspaces/${ws}/loans/${id}/return`),
  update: (
    ws: string,
    id: string,
    body: { due_date?: string; notes?: string },
  ) => patch<Loan>(`/workspaces/${ws}/loans/${id}`, body),
  extend: (ws: string, id: string, new_due_date: string) =>
    patch<Loan>(`/workspaces/${ws}/loans/${id}/extend`, { new_due_date }),
  byBorrower: (ws: string, borrowerId: string) =>
    get<{ items: Loan[] }>(`/workspaces/${ws}/borrowers/${borrowerId}/loans`),
};
