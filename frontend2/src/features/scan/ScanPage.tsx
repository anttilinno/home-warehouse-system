// frontend2/src/features/scan/ScanPage.tsx
//
// Phase 64 ScanPage — 3-tab orchestration (SCAN / MANUAL / HISTORY) composing
// every artifact landed in Waves 0–2:
//   - @/lib/scanner (polyfill + history + feedback + formatScanTime)
//   - Hooks: useScanHistory, useScanFeedback, useScanLookup (stub)
//   - Domain components: BarcodeScanner, ManualBarcodeEntry, ScanResultBanner,
//     ScanErrorPanel, ScanHistoryList
//   - Retro atoms: RetroTabs
//
// State machine (all component-local — no global store):
//   tab         : "scan" | "manual" | "history" (default "scan" per D-05; no
//                 persistence per D-06)
//   banner      : BannerState | null — non-null iff scanner is paused (D-02)
//   errorKind   : BarcodeScannerErrorKind | null — routes to the correct
//                 ScanErrorPanel variant in place of the Scan tab body (D-09)
//   scannerKey  : number — bumped by RETRY to force-remount BarcodeScanner and
//                 re-run initBarcodePolyfill() (D-19 narrowed 2026-04-18; scope
//                 is polyfill retry ONLY — React.lazy chunk-load failures are
//                 caught by the route-level ErrorBoundaryPage).
//
// Post-decode path (shared by live decode, manual submit, and history-tap per
// D-15 + D-20): useScanFeedback.trigger() → useScanHistory.add() →
// setBanner({ code, format, timestamp }). The banner renders above whatever
// tab body is active — NO auto-switch (D-20).
//
// D-01 MANDATORY callsite lock: ScanPage invokes useScanLookup(banner?.code ??
// null) exactly once per render. The Phase 64 stub returns
// { status: "idle", match: null, error: null, refetch: no-op } so the call has
// zero runtime effect today; Phase 65 swaps the stub for a real TanStack Query
// call without changing any callsite wiring. ScanPage.test.tsx Test 15
// enforces this with a spy — removing the callsite will fail the gate.
//
// D-08 AudioContext prime: a single primedRef-guarded onPointerDown on the
// page root calls useScanFeedback.prime() exactly once per mount, satisfying
// iOS Safari's "resume inside the opening user gesture" rule.
//
// RETRY scope (D-19 narrowed 2026-04-18): only initBarcodePolyfill failure is
// in-scope. A full React.lazy chunk-load failure propagates above any
// in-feature try/catch and is caught by the existing route-level
// ErrorBoundaryPage by architectural design.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { RetroTabs } from "@/components/retro";
import {
  BarcodeScanner,
  ManualBarcodeEntry,
  ScanErrorPanel,
  ScanResultBanner,
  type BarcodeScannerErrorKind,
} from "@/components/scan";
import { ScanHistoryList } from "./ScanHistoryList";
import { useScanHistory } from "./hooks/useScanHistory";
import { useScanFeedback } from "./hooks/useScanFeedback";
import { useScanLookup } from "./hooks/useScanLookup";
import type { ScanHistoryEntry } from "@/lib/scanner";

type TabKey = "scan" | "manual" | "history";

interface BannerState {
  code: string;
  format: string;
  timestamp: number;
}

export function ScanPage() {
  const { t } = useLingui();

  const [tab, setTab] = useState<TabKey>("scan"); // D-05 default + D-06 no persistence
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [errorKind, setErrorKind] =
    useState<BarcodeScannerErrorKind | null>(null);
  const [scannerKey, setScannerKey] = useState(0);

  const history = useScanHistory();
  const feedback = useScanFeedback();
  const navigate = useNavigate();

  // D-01 MANDATORY callsite lock (Phase 64 D-18 + Test 15): this call is
  // a contract. Phase 64 wired it as a stub; Phase 65 Plan 65-04 swapped
  // the body to a real TanStack Query call. The callsite itself —
  // useScanLookup(banner?.code ?? null) — MUST NOT change.
  const lookup = useScanLookup(banner?.code ?? null);

  // D-22 race-guard invariant (Phase 65): backfill history entityType +
  // entityId ONLY when lookup resolves to a success+match. useScanHistory
  // .update noops-if-missing, so a stale resolve arriving after the user
  // scanned a different code (and the old entry was de-duped out) does
  // nothing. On not-found (match === null) there is no entity to record.
  // On error there is no match either. See 65-RESEARCH.md §Pitfall 3
  // "Open question race" — documented invariant: update only fires on
  // success+match; nav on not-found goes to /items/new (no update); nav
  // on match goes to /items/{id} via VIEW ITEM (update has already fired).
  //
  // DEPS NOTE: the deps array lists `history.update` — NOT `history`.
  // Plan 65-04 Task 3 wraps `update` in useCallback(..., []) for stable
  // identity. Using the whole `history` object would re-fire this effect
  // every render (React returns a new return-object each hook call) and
  // defeat the match-gate.
  useEffect(() => {
    if (lookup.status === "success" && lookup.match) {
      const effectiveCode = lookup.match.barcode ?? banner?.code ?? "";
      if (effectiveCode) {
        history.update(effectiveCode, {
          entityType: "item",
          entityId: lookup.match.id,
          entityName: lookup.match.name,
        });
      }
    }
  }, [lookup.status, lookup.match, banner?.code, history.update]);

  // Single post-decode code path shared by live decode + manual submit +
  // history tap (D-15).
  const handleDecode = useCallback(
    (decoded: { code: string; format: string }) => {
      feedback.trigger();
      history.add({
        code: decoded.code,
        format: decoded.format,
        entityType: "unknown",
      });
      setBanner({
        code: decoded.code,
        format: decoded.format,
        timestamp: Date.now(),
      });
    },
    [feedback, history],
  );

  const handleManualSubmit = useCallback(
    (code: string) => {
      handleDecode({ code, format: "MANUAL" });
    },
    [handleDecode],
  );

  // D-15 + D-20: re-fire the same code path; NO auto-switch to the Scan tab.
  const handleHistoryTap = useCallback(
    (entry: ScanHistoryEntry) => {
      handleDecode({ code: entry.code, format: entry.format });
    },
    [handleDecode],
  );

  const handleScanAgain = useCallback(() => {
    setBanner(null);
  }, []);

  const handleViewItem = useCallback(
    (itemId: string) => {
      navigate(`/items/${itemId}`);
    },
    [navigate],
  );

  const handleCreateWithBarcode = useCallback(
    (code: string) => {
      navigate(`/items/new?barcode=${encodeURIComponent(code)}`);
    },
    [navigate],
  );

  // Phase 65 NEW — distinct from the existing `handleRetry` below (Phase 64
  // scanner-polyfill retry). `handleLookupRetry` retries the useScanLookup
  // TanStack Query via query.refetch() for the banner's ERROR state (D-21).
  // Two retry callbacks co-exist by design — the banner's RETRY button
  // targets the lookup query, ScannerErrorPanel's RETRY targets the
  // scanner polyfill.
  const handleLookupRetry = useCallback(() => {
    lookup.refetch();
  }, [lookup]);

  const handleScannerError = useCallback((kind: BarcodeScannerErrorKind) => {
    setErrorKind(kind);
  }, []);

  const handleUseManualEntry = useCallback(() => {
    setErrorKind(null);
    setTab("manual");
  }, []);

  // D-19 (narrowed 2026-04-18): clears errorKind + bumps scannerKey to
  // remount the BarcodeScanner subtree, re-running initBarcodePolyfill() via
  // its mount effect. Polyfill-retry scope ONLY.
  const handleRetry = useCallback(() => {
    setErrorKind(null);
    setScannerKey((k) => k + 1);
  }, []);

  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  // State-machine invariant: paused iff the banner is visible (D-02).
  const paused = banner !== null;

  // D-08 AudioContext prime — ref-guarded so we call prime() at most once
  // regardless of how many pointerdown events fire. Uses onPointerDown (NOT
  // onClick) to satisfy iOS Safari's first-gesture resume rule.
  const primedRef = useRef(false);
  const handlePointerDown = useCallback(() => {
    if (primedRef.current) return;
    primedRef.current = true;
    feedback.prime();
  }, [feedback]);

  return (
    <div
      data-testid="scan-page-root"
      className="max-w-[480px] mx-auto flex flex-col gap-lg p-lg"
      onPointerDown={handlePointerDown}
    >
      <h1 className="text-[20px] font-bold uppercase tracking-wider text-retro-ink">
        {t`SCAN`}
      </h1>

      <RetroTabs
        tabs={[
          { key: "scan", label: t`SCAN` },
          { key: "manual", label: t`MANUAL` },
          { key: "history", label: t`HISTORY` },
        ]}
        activeTab={tab}
        onTabChange={(k) => setTab(k as TabKey)}
      />

      {banner && (
        // Phase 65 Plan 65-07: real useScanLookup state threaded through.
        // LOADING / MATCH / NOT-FOUND / ERROR variants derive from
        // lookupStatus + match in ScanResultBanner itself; idle falls
        // through to LOADING visuals for the first render after decode.
        <ScanResultBanner
          code={banner.code}
          format={banner.format}
          timestamp={banner.timestamp}
          lookupStatus={lookup.status}
          match={lookup.match}
          onScanAgain={handleScanAgain}
          onViewItem={handleViewItem}
          onCreateWithBarcode={handleCreateWithBarcode}
          onRetry={handleLookupRetry}
        />
      )}

      <div role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "scan" &&
          (errorKind ? (
            <ScanErrorPanel
              kind={errorKind}
              onUseManualEntry={handleUseManualEntry}
              onRetry={
                errorKind === "library-init-fail" ? handleRetry : undefined
              }
              onReload={errorKind === "no-camera" ? handleReload : undefined}
            />
          ) : (
            <BarcodeScanner
              key={scannerKey}
              paused={paused}
              onDecode={handleDecode}
              onError={handleScannerError}
            />
          ))}
        {tab === "manual" && <ManualBarcodeEntry onSubmit={handleManualSubmit} />}
        {tab === "history" && (
          <ScanHistoryList
            entries={history.entries}
            onSelect={handleHistoryTap}
            onClear={history.clear}
          />
        )}
      </div>
    </div>
  );
}
