import { useQuery } from "@tanstack/react-query";
import { borrowersApi, borrowerKeys, type Borrower } from "@/lib/api/borrowers";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Fetch a single borrower by id. `enabled` gate prevents a request when
 * workspaceId or id are not yet available.
 */
export function useBorrower(id: string | undefined) {
  const { workspaceId } = useAuth();
  return useQuery<Borrower>({
    queryKey: borrowerKeys.detail(id ?? ""),
    queryFn: () => borrowersApi.get(workspaceId!, id!),
    enabled: !!workspaceId && !!id,
  });
}
