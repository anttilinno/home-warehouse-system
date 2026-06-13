import { get } from "@/lib/api";
import type { Loan } from "@/lib/types";

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
};
