import { useQuery } from "@tanstack/react-query";
import { loansApi, loanKeys, type LoanListParams } from "@/lib/api/loans";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Paginated loan history query.
 *
 * Wraps GET /workspaces/{wsId}/loans?page=...&limit=... Accepts a
 * `LoanListParams`-shaped input so the list page can pass through page/limit
 * and optional `active` / `overdue` filters.
 *
 * TanStack Query v5 idiom: `placeholderData: (prev) => prev` keeps the
 * previous page visible during refetch — smooth pagination without flicker.
 * Replaces the v4 `keepPreviousData: true` flag (Pitfall 6).
 */
export function useLoansHistory(params: LoanListParams = {}) {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: loanKeys.list(params),
    queryFn: () => loansApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    placeholderData: (prev) => prev,
  });
}
