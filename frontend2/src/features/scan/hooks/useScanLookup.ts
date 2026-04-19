// Phase 65 LOOK-01 — real lookup body swap.
//
// Shape locked by Phase 64 D-18 (ScanLookupResult) and callsite locked by
// ScanPage.tsx line 82 + ScanPage.test.tsx Test 15. This file ONLY swaps
// the body — the function signature + return shape are frozen.
//
// Status mapping (D-18 exhaustive union):
//   idle    — no code yet OR no workspaceId yet (enabled:false)
//   loading — enabled:true and no data cached (query.isPending)
//   success — query resolved (match: Item | null)
//   error   — query rejected
import { useQuery } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import { scanKeys, type ScanLookupResult } from "@/lib/api/scan";
import { useAuth } from "@/features/auth/AuthContext";

export function useScanLookup(code: string | null): ScanLookupResult {
  const { workspaceId } = useAuth();
  const query = useQuery({
    queryKey: scanKeys.lookup(code ?? ""),
    queryFn: () => itemsApi.lookupByBarcode(workspaceId!, code!),
    enabled: !!code && !!workspaceId,
    staleTime: 30_000,
    gcTime: 300_000,
  });

  let status: ScanLookupResult["status"];
  if (!code || !workspaceId) {
    status = "idle";
  } else if (query.isPending) {
    status = "loading";
  } else if (query.isError) {
    status = "error";
  } else {
    status = "success";
  }

  return {
    status,
    match: query.data ?? null,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}
