// Phase 64 STUB - always returns { status: 'idle', match: null, error: null, refetch: no-op }.
// Phase 65 (LOOK-01) replaces the body with a real TanStack Query call; the return shape
// stays identical so callsites (ScanResultBanner, ScanPage) do not change.
import type { ScanLookupResult } from "@/lib/api/scan";

export function useScanLookup(_code: string | null): ScanLookupResult {
  return {
    status: "idle",
    match: null,
    error: null,
    refetch: () => {},
  };
}
