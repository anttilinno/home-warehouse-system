import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryApi, type Category } from "@/lib/api/category";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { buildTree, type TreeNode } from "@/features/taxonomy/lib/buildTree";

// Phase 10 Plan 02 — the Categories list query. Source: useBorrowersQuery (key
// ["borrowers", wsId, …] + enabled !!wsId + retry false) adapted to the BARE
// { items } category envelope (Pitfall 2 — categoryApi.list returns no total).
//
// The query key is the PLAIN ["categories", wsId] PREFIX so the mutation-layer
// invalidate (useCategoryMutations) covers it WITHOUT exact:true (T-10-03 — no
// stale tree after a mutation). The tree is built CLIENT-SIDE from the flat
// rows via buildTree(parent_category_id) (RESEARCH OQ1), memoized on `rows`.

export interface UseCategoriesQueryResult {
  rows: Category[];
  tree: TreeNode<Category>[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useCategoriesQuery(): UseCategoriesQueryResult {
  const { currentWorkspaceId: wsId } = useWorkspace();

  const query = useQuery({
    queryKey: ["categories", wsId],
    queryFn: () => categoryApi.list(wsId as string).then((r) => r.items),
    enabled: !!wsId,
    retry: false,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);

  // Client-build the tree from the flat rows. parent_category_id (NOT
  // parent_location) — buildTree surfaces orphans at root (Pitfall 7).
  const tree = useMemo(
    () => buildTree(rows, (c) => c.parent_category_id),
    [rows],
  );

  return {
    rows,
    tree,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
