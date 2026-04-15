import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  categoriesApi,
  categoryKeys,
  type Category,
} from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";
import { buildTree, type TreeNode } from "../tree/buildTree";

export function useCategoriesTree(showArchived: boolean) {
  const { workspaceId } = useAuth();
  const params = { archived: showArchived ? undefined : false } as const;
  const query = useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(workspaceId!, params),
    enabled: !!workspaceId,
  });
  const items: Category[] = query.data?.items ?? [];
  const tree: TreeNode<Category>[] = useMemo(
    () => buildTree(items, (c) => c.parent_category_id ?? null),
    [items],
  );
  return { ...query, items, tree };
}
