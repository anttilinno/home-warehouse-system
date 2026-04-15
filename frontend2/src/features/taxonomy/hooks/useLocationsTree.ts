import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  locationsApi,
  locationKeys,
  type Location,
} from "@/lib/api/locations";
import { useAuth } from "@/features/auth/AuthContext";
import { buildTree, type TreeNode } from "../tree/buildTree";

export function useLocationsTree(showArchived: boolean) {
  const { workspaceId } = useAuth();
  const params = { archived: showArchived ? undefined : false } as const;
  const query = useQuery({
    queryKey: locationKeys.list({ ...params, _fetchAll: true } as never),
    queryFn: async () => {
      const all: Location[] = [];
      let page = 1;
      // Safety: never exceed 50 pages (5000 locations) to prevent infinite loop.
      for (let safety = 0; safety < 50; safety++) {
        const res = await locationsApi.list(workspaceId!, {
          ...params,
          page,
          limit: 100,
        });
        all.push(...res.items);
        if (page >= res.total_pages || res.items.length === 0) break;
        page++;
      }
      return { items: all, total: all.length, page: 1, total_pages: 1 };
    },
    enabled: !!workspaceId,
  });
  const items: Location[] = query.data?.items ?? [];
  const tree: TreeNode<Location>[] = useMemo(
    () => buildTree(items, (l) => l.parent_location ?? null),
    [items],
  );
  return { ...query, items, tree };
}
