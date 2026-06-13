import { useQuery } from "@tanstack/react-query";
import { loansApi, type PartitionedLoans } from "@/lib/api/loans";

// Phase 8 Plan 05 — the per-borrower loans query (LOAN-06). Keyed
// ["loans", wsId, "by-borrower", borrowerId] so it shares the ["loans", wsId]
// prefix that useLoanMutations.onSettled invalidates (covers list + by-item +
// by-borrower). loansApi.byBorrower returns a BARE { items: Loan[] } envelope
// (Plan 01); we partition client-side on is_active — mirroring loansApi.byItem's
// partition (07-RESEARCH OQ2). Status + overdue stay SERVER-authoritative
// (loanStatus / loan.is_overdue) — never client date math.
export function useBorrowerLoans(
  wsId: string,
  borrowerId: string,
): ReturnType<typeof useQuery<PartitionedLoans>> {
  return useQuery({
    queryKey: ["loans", wsId, "by-borrower", borrowerId],
    queryFn: () =>
      loansApi.byBorrower(wsId, borrowerId).then((res) => {
        const active: PartitionedLoans["active"] = [];
        const history: PartitionedLoans["history"] = [];
        for (const loan of res.items) {
          (loan.is_active ? active : history).push(loan);
        }
        return { active, history };
      }),
    enabled: Boolean(wsId) && Boolean(borrowerId),
  });
}
