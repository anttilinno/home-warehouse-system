import { useQuery } from "@tanstack/react-query";
import { loansApi, loanKeys } from "@/lib/api/loans";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Overdue loans list query (is_active = true AND due_date < now).
 *
 * Wraps GET /workspaces/{wsId}/loans/overdue. Keyed on a params-shaped tuple
 * `{ overdue: true }` so the TanStack cache stays aligned with the paginated
 * `useLoansHistory` query shape.
 */
export function useLoansOverdue() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: loanKeys.list({ overdue: true }),
    queryFn: () => loansApi.listOverdue(workspaceId!),
    enabled: !!workspaceId,
  });
}
