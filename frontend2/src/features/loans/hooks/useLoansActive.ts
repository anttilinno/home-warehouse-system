import { useQuery } from "@tanstack/react-query";
import { loansApi, loanKeys } from "@/lib/api/loans";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Active loans list query (is_active = true).
 *
 * Wraps GET /workspaces/{wsId}/loans/active which returns every open loan
 * with the 62-01 item + borrower decoration embedded. Workspace-gated via
 * `enabled: !!workspaceId` — AuthContext owns workspaceId (v2.0/v2.1 rule:
 * never pass workspaceId as a prop).
 */
export function useLoansActive() {
  const { workspaceId } = useAuth();
  return useQuery({
    queryKey: loanKeys.list({ active: true }),
    queryFn: () => loansApi.listActive(workspaceId!),
    enabled: !!workspaceId,
  });
}
