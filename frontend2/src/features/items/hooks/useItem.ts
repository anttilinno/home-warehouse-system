import { useQuery } from "@tanstack/react-query";
import { itemsApi, itemKeys, type Item } from "@/lib/api/items";
import { useAuth } from "@/features/auth/AuthContext";

/**
 * Single-item detail query. Disabled when id or workspaceId is missing (safe
 * to call with undefined id; React Query keeps the hook-order invariant).
 */
export function useItem(id: string | undefined) {
  const { workspaceId } = useAuth();
  return useQuery<Item>({
    queryKey: itemKeys.detail(id ?? ""),
    queryFn: () => itemsApi.get(workspaceId!, id!),
    enabled: !!workspaceId && !!id,
  });
}
