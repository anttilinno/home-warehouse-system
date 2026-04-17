import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { loansApi, loanKeys, type Loan } from "@/lib/api/loans";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Per-borrower loans query.
 *
 * Wraps GET /workspaces/{wsId}/borrowers/{borrowerId}/loans. Unlike
 * `useLoansForItem` (one active loan max) a borrower may hold many open
 * loans simultaneously — the hook returns:
 *   - activeLoans: open loans sorted most-recent-loan-out first
 *   - history: returned loans sorted most-recent-returned first
 *
 * Pure-`useMemo` partition keyed on query.data for stability.
 */
export function useLoansForBorrower(borrowerId: string | undefined) {
  const { workspaceId } = useAuth();
  const query = useQuery({
    queryKey: borrowerId
      ? loanKeys.forBorrower(borrowerId)
      : ["loans", "forBorrower", "pending"],
    queryFn: () => loansApi.listForBorrower(workspaceId!, borrowerId!),
    enabled: !!workspaceId && !!borrowerId,
  });
  const { activeLoans, history } = useMemo<{
    activeLoans: Loan[];
    history: Loan[];
  }>(() => {
    const items = query.data?.items ?? [];
    const active = items
      .filter((l) => l.is_active)
      .slice()
      .sort(
        (a, b) =>
          new Date(b.loaned_at).getTime() - new Date(a.loaned_at).getTime(),
      );
    const hist = items
      .filter((l) => !l.is_active)
      .slice()
      .sort((a, b) => {
        const at = new Date(a.returned_at ?? a.updated_at).getTime();
        const bt = new Date(b.returned_at ?? b.updated_at).getTime();
        return bt - at;
      });
    return { activeLoans: active, history: hist };
  }, [query.data]);
  return { ...query, activeLoans, history };
}
