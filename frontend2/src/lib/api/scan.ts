// Phase 64 scaffold - Phase 65 (LOOK-01) replaces scanApi + useScanLookup body
// with a real HTTP call against GET /workspaces/{wsId}/items?search={code}&limit=1.
// Shape locked here so Phase 64 callsites (ScanResultBanner, ScanPage) stay intact.
import type { Item } from "@/lib/api/items";

export type ScanLookupStatus = "idle" | "loading" | "success" | "error";

export interface ScanLookupResult {
  status: ScanLookupStatus;
  match: Item | null;
  error: Error | null;
  refetch: () => void;
}

// Phase 64: no endpoints. Phase 65 adds lookupByBarcode(wsId, code).
export const scanApi = {
  // intentionally empty in Phase 64
} as const;

export const scanKeys = {
  all: ["scan"] as const,
  lookups: () => [...scanKeys.all, "lookup"] as const,
  lookup: (code: string) => [...scanKeys.lookups(), code] as const,
};
