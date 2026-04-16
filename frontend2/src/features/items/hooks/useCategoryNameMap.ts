import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoriesApi, categoryKeys } from "@/lib/api/categories";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Category name resolver for the items list/detail pages.
 *
 * Returns a Map<categoryId, name> built from a single workspace-wide fetch.
 * Avoids N+1 category fetches per item row.
 *
 * CRITICAL (Pitfall 7): requests `archived: true` so that items assigned to a
 * subsequently-archived category still render the category name (not "—").
 * The category picker combobox in the form may separately exclude archived
 * for UX reasons — that is a different query with a different cache key and
 * is OK.
 *
 * staleTime: 60_000 — categories change rarely; avoid refetch storms on
 * pagination.
 */
export function useCategoryNameMap() {
  const { workspaceId } = useAuth();
  const params = { page: 1, limit: 100, archived: true } as const;
  const query = useQuery({
    queryKey: categoryKeys.list(params),
    queryFn: () => categoriesApi.list(workspaceId!, params),
    enabled: !!workspaceId,
    staleTime: 60_000,
  });
  const map = useMemo(() => {
    const m = new Map<string, string>();
    (query.data?.items ?? []).forEach((c) => m.set(c.id, c.name));
    return m;
  }, [query.data]);
  return { map, isPending: query.isPending, isError: query.isError };
}
