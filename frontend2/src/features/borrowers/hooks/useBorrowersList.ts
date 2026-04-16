import { useQuery } from "@tanstack/react-query";
import {
  borrowersApi,
  borrowerKeys,
  type Borrower,
  type BorrowerListParams,
} from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Fetch the borrower list for the current workspace.
 * When showArchived=true, the backend includes archived rows; otherwise
 * only active borrowers are returned.
 *
 * Pagination: v1 fetches the first 100 rows (single page). If borrower
 * count grows beyond that in the future, wire RetroPagination (Phase 57
 * primitive already shipped).
 */
export function useBorrowersList(showArchived: boolean) {
  const { workspaceId } = useAuth();
  const params: BorrowerListParams = {
    page: 1,
    limit: 100,
    archived: showArchived ? true : undefined,
  };
  const query = useQuery({
    queryKey: borrowerKeys.list(params),
    queryFn: () => borrowersApi.list(workspaceId!, params),
    enabled: !!workspaceId,
  });
  const items: Borrower[] = query.data?.items ?? [];
  return { ...query, items };
}
