import { useMemo } from "react";
import { categoryApi, type Category } from "@/lib/api/category";
import { buildTree, type TreeNode } from "@/features/taxonomy/lib/buildTree";
import { useTaxonomyListQuery } from "./useTaxonomyListQuery";

// Phase 10 Plan 02 — the Categories list query. Built on the shared
// useTaxonomyListQuery skeleton (PLAIN ["categories", wsId] PREFIX so the
// useCategoryMutations invalidate covers it WITHOUT exact:true). The BARE
// { items } envelope (Pitfall 2 — categoryApi.list returns no total) is unwrapped
// in the fetch arg. The tree is built CLIENT-SIDE from the flat rows via
// buildTree(parent_category_id) (RESEARCH OQ1), memoized on `rows`.

export interface UseCategoriesQueryResult {
  rows: Category[];
  tree: TreeNode<Category>[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useCategoriesQuery(): UseCategoriesQueryResult {
  const base = useTaxonomyListQuery<Category>("categories", (wsId) =>
    categoryApi.list(wsId).then((r) => r.items),
  );

  // Client-build the tree from the flat rows. parent_category_id (NOT
  // parent_location) — buildTree surfaces orphans at root (Pitfall 7).
  const tree = useMemo(
    () => buildTree(base.rows, (c) => c.parent_category_id),
    [base.rows],
  );

  return { ...base, tree };
}
