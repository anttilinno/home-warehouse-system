import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  containersApi,
  containerKeys,
  type Container,
} from "@/lib/api/containers";
import { useAuth } from "@/features/auth/AuthContext";

export function useContainersByLocation(
  opts: { locationId?: string; showArchived?: boolean } = {},
) {
  const { workspaceId } = useAuth();
  const archived = opts.showArchived ? undefined : false;
  const location_id = opts.locationId;
  const query = useQuery({
    queryKey: containerKeys.list({
      archived,
      location_id,
      _fetchAll: true,
    } as never),
    queryFn: async () => {
      const all: Container[] = [];
      let page = 1;
      for (let safety = 0; safety < 50; safety++) {
        const res = await containersApi.list(workspaceId!, {
          archived,
          location_id,
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
  const items: Container[] = query.data?.items ?? [];
  const groupedByLocation = useMemo(() => {
    const map = new Map<string, Container[]>();
    for (const c of items) {
      const arr = map.get(c.location_id) ?? [];
      arr.push(c);
      map.set(c.location_id, arr);
    }
    return map;
  }, [items]);
  return { ...query, items, groupedByLocation };
}
