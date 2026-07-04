import { useMemo } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Item, ItemListResponse } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";

// Scan every cached ["items", wsId, …] list page for an item whose short_code
// or barcode matches `code`. Pure over cache data — no network. Mirrors the
// online itemsApi.lookupByBarcode scope (items only). First match wins;
// de-dupe is implicit (return on first hit).
export function findCachedItemByCode(
  client: QueryClient,
  wsId: string,
  code: string,
): Item | null {
  if (!wsId || !code) return null;
  const entries = client.getQueriesData<ItemListResponse>({
    queryKey: ["items", wsId],
  });
  for (const [, data] of entries) {
    const items = data?.items;
    if (!Array.isArray(items)) continue;
    const hit = items.find(
      (it) => it.short_code === code || it.barcode === code,
    );
    if (hit) return hit;
  }
  return null;
}

// Offline-scan hook (extracted out of ScanPage to keep it under the
// complexity gate). Only consults the cache, and only while offline, so an
// online lookup always wins via the caller's `lookup.data ?? offlineHit`.
export function useOfflineBarcodeHit(
  isOnline: boolean,
  code: string | undefined,
): Item | null {
  const queryClient = useQueryClient();
  const { currentWorkspaceId } = useWorkspace();
  return useMemo(
    () =>
      !isOnline && code
        ? findCachedItemByCode(queryClient, currentWorkspaceId ?? "", code)
        : null,
    [isOnline, code, queryClient, currentWorkspaceId],
  );
}
