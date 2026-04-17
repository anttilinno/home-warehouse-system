import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { loansApi, loanKeys, type Loan } from "@/lib/api/loans";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Per-item loans query.
 *
 * Wraps GET /workspaces/{wsId}/inventory/{inventoryId}/loans and partitions
 * the response into:
 *   - activeLoan: the single currently-open loan (inventory items are loaned
 *     one-at-a-time), or null when the item is available
 *   - history: returned loans sorted most-recent-first (by returned_at,
 *     falling back to updated_at)
 *
 * Partition is a pure `useMemo` over `query.data` so it's immediately
 * unit-testable and stable across re-renders.
 *
 * Disabled when either workspaceId or inventoryId is falsy; when the
 * inventoryId is not yet known the hook still returns `{ isPending: true,
 * activeLoan: null, history: [] }`.
 */
export function useLoansForItem(inventoryId: string | undefined) {
  const { workspaceId } = useAuth();
  const query = useQuery({
    queryKey: inventoryId
      ? loanKeys.forItem(inventoryId)
      : ["loans", "forItem", "pending"],
    queryFn: () => loansApi.listForItem(workspaceId!, inventoryId!),
    enabled: !!workspaceId && !!inventoryId,
  });
  const { activeLoan, history } = useMemo<{
    activeLoan: Loan | null;
    history: Loan[];
  }>(() => {
    const items = query.data?.items ?? [];
    const active = items.find((l) => l.is_active) ?? null;
    const hist = items
      .filter((l) => !l.is_active)
      .slice()
      .sort((a, b) => {
        const at = new Date(a.returned_at ?? a.updated_at).getTime();
        const bt = new Date(b.returned_at ?? b.updated_at).getTime();
        return bt - at; // most-recent first
      });
    return { activeLoan: active, history: hist };
  }, [query.data]);
  return { ...query, activeLoan, history };
}
