/**
 * useScanResolve — the SINGLE post-scan funnel (binding override 7 / OQ7).
 *
 * Live-scan, manual-entry, and history-tap all call ONE `handleResolveCode`, so
 * the four-state banner (LOADING / MATCH / NOT-FOUND / ERROR) and the quick
 * actions behave identically regardless of how the code arrived (RESEARCH
 * Pattern 3, legacy `scan/page.tsx:205-216`).
 *
 * The banner state is DERIVED from a TanStack `useQuery(["item-by-barcode",
 * wsId, code])` rather than hand-managed: `lookup.status`/`lookup.data` map
 * directly onto the four banner states. Pause is PROP-DRIVEN (this hook never
 * unmounts the scanner — binding override 1); the `<Scanner paused={paused}>`
 * prop in 11-04 consumes it.
 *
 * Render-loop guard (Pitfall 6 / Phase 65 D-22): the effect that refines the
 * history entry depends ONLY on the PRIMITIVE `lookup.status` / `lookup.data` /
 * `banner.code` — never on the history array (which mutates every refinement and
 * would re-trigger the effect forever).
 */

import { useCallback, useEffect, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { itemsApi } from "@/lib/api/items";
import type { Item } from "@/lib/types";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { addToScanHistory, updateScanHistory } from "@/lib/scanner";

/** The active banner target: the code being resolved + how it was captured. */
export interface ScanBanner {
  code: string;
  format: string;
}

export interface UseScanResolveArgs {
  /**
   * Feedback trigger fired the instant a code is funneled (beep + haptic +
   * flash). Injected (from useScanFeedback) so the funnel stays testable.
   */
  feedback: () => void;
}

export interface UseScanResolveResult {
  /** THE funnel. No-op on empty code; pauses, sets the banner, fires feedback. */
  handleResolveCode: (code: string, format: string) => void;
  /** Pause flag for `<Scanner paused>` (pause-not-unmount). */
  paused: boolean;
  /** Escape hatch for manual pause control (e.g. tab blur). */
  setPaused: (paused: boolean) => void;
  /** The active banner target, or null when scanning. */
  banner: ScanBanner | null;
  /** The 4-state lookup query (status/data drive the banner state). */
  lookup: UseQueryResult<Item | null>;
  /** Clear the banner + unpause — the "Back to Scan" action. */
  resume: () => void;
}

/**
 * Post-scan state machine. Returns the single funnel + the derived query.
 *
 * Banner-state mapping (consumed by 11-04's ResultBanner):
 *  - `lookup.status === 'pending'` (with a banner) → LOADING
 *  - `'success'` + `data` (Item)                   → MATCH
 *  - `'success'` + `data === null` (404)           → NOT-FOUND
 *  - `'error'`                                      → ERROR
 */
export function useScanResolve({
  feedback,
}: UseScanResolveArgs): UseScanResolveResult {
  const { currentWorkspaceId } = useWorkspace();
  const wsId = currentWorkspaceId ?? "";

  const [banner, setBanner] = useState<ScanBanner | null>(null);
  const [paused, setPaused] = useState(false);

  const lookup = useQuery<Item | null>({
    queryKey: ["item-by-barcode", wsId, banner?.code],
    // banner is guaranteed non-null while enabled is true (enabled gates on it).
    queryFn: () => itemsApi.lookupByBarcode(wsId, banner!.code),
    enabled: Boolean(wsId && banner?.code),
    // staleTime:0 so re-resolving the SAME code (history re-tap) re-fires the
    // lookup instead of serving a cached entry — a re-tap must behave like a
    // fresh scan.
    staleTime: 0,
    // No retries: a 500 should surface as ERROR immediately, not after backoff.
    retry: false,
  });

  const handleResolveCode = useCallback(
    (code: string, format: string) => {
      if (!code) return; // empty decode → no-op (no banner, no pause, no feedback)
      setPaused(true); // pause the scanner (prop-driven, never unmount)
      setBanner({ code, format }); // enables the query
      feedback(); // beep + haptic + flash (SCAN-03)
      // Record the scan immediately as `unknown`; refined post-lookup below.
      addToScanHistory({ code, format, entityType: "unknown" });
    },
    [feedback],
  );

  const resume = useCallback(() => {
    setBanner(null);
    setPaused(false);
  }, []);

  // Refine the history entry once the lookup settles. PRIMITIVE deps only
  // (status/data/code) — depending on the history array would loop forever
  // (Pitfall 6 / Phase 65 D-22).
  const lookupStatus = lookup.status;
  const lookupData = lookup.data;
  const bannerCode = banner?.code;
  useEffect(() => {
    if (lookupStatus === "success" && bannerCode) {
      // lookupData is Item on MATCH, null on NOT-FOUND.
      updateScanHistory(bannerCode, lookupData ?? null);
    }
  }, [lookupStatus, lookupData, bannerCode]);

  return { handleResolveCode, paused, setPaused, banner, lookup, resume };
}
