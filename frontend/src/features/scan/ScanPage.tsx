import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { Window, RetroTabs, RetroEmptyState } from "@/components/retro";
import {
  ScanResultBanner,
  type ScanBannerStatus,
  ManualBarcodeEntry,
  ScanHistoryList,
  QuickActionMenu,
} from "@/components/scan";
import { BarcodeScanner } from "@/components/scan/BarcodeScanner";
import { ScanViewfinderOverlay } from "@/components/scan/ScanViewfinderOverlay";
import { ScanTorchToggle } from "@/components/scan/ScanTorchToggle";
import { normalizeScanCode } from "./normalizeScanCode";
import { useScanResolve } from "./useScanResolve";
import { useScanFeedback } from "./useScanFeedback";
import { useTorch } from "./useTorch";
import { useScanHistory } from "./useScanHistory";
import { useIsOnline } from "@/lib/offline/useIsOnline";
import { useOfflineBarcodeHit } from "@/lib/offline/localBarcodeLookup";

// Phase 11 Plan 06 — the /scan route orchestration (RESEARCH Pattern 2 / binding
// override 1). THE non-negotiable architecture decision lives here:
//
//   BarcodeScanner is mounted ONCE in a PERSISTENT always-mounted sibling layer
//   whose visibility is CSS-toggled (`hidden` class) — it is NEVER a RetroTabs
//   panel child (RetroTabs unmounts inactive panels; remounting the <video> makes
//   iOS standalone PWAs re-prompt for camera permission — Pitfall 1 / T-11-14).
//
// RetroTabs holds ONLY the Manual + History overlay panels (the Scan tab's panel
// is an empty spacer — the real camera is the persistent sibling above). All three
// capture paths (live decode, manual submit, history re-tap) funnel through ONE
// handler (useScanResolve.handleResolveCode — binding override 7). The 4-state
// banner + the quick-action overlay render OVER the always-mounted scanner.

type ScanTab = "scan" | "manual" | "history";

const VALID_TABS: ScanTab[] = ["scan", "manual", "history"];

function isScanTab(value: string | null): value is ScanTab {
  return value !== null && (VALID_TABS as string[]).includes(value);
}

/**
 * Map the useScanResolve lookup query state → the banner's 5-state status.
 *
 * A code cached from a prior online scan still resolves `status:"success"`
 * (served from the persisted query cache) even offline — that stays
 * MATCH/NOT-FOUND, unchanged. A NEW/uncached code can't reach the network
 * offline: TanStack's default `networkMode:"online"` never calls the queryFn,
 * so it sits at `status:"pending"`/`fetchStatus:"paused"` forever (not
 * "error") — that's the offline branch below. A genuine in-flight failure
 * while offline (connection dropped mid-request) lands in `status:"error"`
 * too; either way, offline + can't-resolve → the OFFLINE banner, not ERROR.
 */
function bannerStatus(
  status: "pending" | "success" | "error",
  data: unknown,
  isOnline: boolean,
  fetchStatus: "fetching" | "paused" | "idle",
): ScanBannerStatus {
  if (status === "success") return data ? "match" : "not-found";
  if (!isOnline && (status === "error" || fetchStatus === "paused")) {
    return "offline";
  }
  if (status === "error") return "error";
  return "loading";
}

export function ScanPage() {
  const { t } = useLingui();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Tab state synced to ?tab= (LoansListPage recipe). Default = scan.
  const tabParam = searchParams.get("tab");
  const activeTab: ScanTab = isScanTab(tabParam) ? tabParam : "scan";

  const setTab = useCallback(
    (id: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", id);
        return next;
      });
    },
    [setSearchParams],
  );

  // ── Feedback (beep + haptic + flash) + the single resolve funnel. The
  // feedback's success() is injected into the funnel so every funneled code
  // beeps/haptics identically regardless of capture path (SCAN-03).
  const feedback = useScanFeedback();
  const { handleResolveCode, paused, banner, lookup, resume } = useScanResolve({
    feedback: feedback.success,
  });

  const torch = useTorch();
  const history = useScanHistory();

  // THE single funnel wrapper (binding override 7). Every capture path — live
  // decode, manual submit, history re-tap — routes through here. It funnels the
  // code to useScanResolve (which pauses, fires feedback, runs the lookup, and
  // writes the lib history) AND re-syncs the useScanHistory snapshot so the
  // History tab reflects the newest scan immediately. `addToScanHistory` de-dupes
  // by code, so the funnel's own write + this `add` collapse to one entry.
  const resolve = useCallback(
    (rawCode: string, format: string) => {
      // A camera-decoded QR label carries the whole `s.go/<code>` URL — strip
      // it to the bare short_code here, before the fork, so the lookup and the
      // lib/useScanHistory writes all key off the same normalized code.
      const code = normalizeScanCode(rawCode);
      handleResolveCode(code, format);
      if (code) history.add({ code, format, entityType: "unknown" });
    },
    [handleResolveCode, history],
  );

  // ── Quick-action overlay open state (opened from the MATCH banner ▸ ACTIONS).
  const [actionsOpen, setActionsOpen] = useState(false);

  // ── Camera-blocked degrade. NotAllowedError / no-device → swap the camera
  // layer for a recovery empty-state; Manual + History stay usable.
  const [cameraBlocked, setCameraBlocked] = useState(false);

  const handleCameraError = useCallback((_error: unknown) => {
    // Any camera error degrades the scan surface (permission denied / no device).
    setCameraBlocked(true);
  }, []);

  // ── Derived banner status (offline-aware, Phase 4). The banner only renders
  // once a code is in flight.
  const isOnline = useIsOnline();
  // Phase B: a code already sitting in a persisted items-list cache resolves
  // locally while offline (no network round trip needed) — checked only when
  // offline so an online lookup always takes precedence.
  const offlineHit = useOfflineBarcodeHit(isOnline, banner?.code);
  const effectiveItem = lookup.data ?? offlineHit;
  const status = offlineHit
    ? "match"
    : bannerStatus(lookup.status, lookup.data, isOnline, lookup.fetchStatus);
  const showBanner = banner !== null;

  // Opening the quick-action menu (MATCH only). Closing it = Back to Scan.
  const openActions = useCallback(() => setActionsOpen(true), []);
  const closeActions = useCallback(() => {
    setActionsOpen(false);
    resume();
  }, [resume]);

  // ERROR ↻ TRY AGAIN: re-fire the same code through the funnel.
  const retry = useCallback(() => {
    if (banner) resolve(banner.code, banner.format);
  }, [banner, resolve]);

  // History row re-tap → re-funnel through the SAME handler (source: history).
  const onHistorySelect = useCallback(
    (code: string) => {
      resolve(code, "history");
    },
    [resolve],
  );

  // Camera-blocked recovery: jump to the Manual tab.
  const switchToManual = useCallback(() => setTab("manual"), [setTab]);

  // Tabs: the Scan tab's panel is an EMPTY spacer (the camera is the persistent
  // sibling rendered ABOVE the tabs); Manual + History carry the real overlays.
  const tabs: { id: ScanTab; label: ReactNode; content: ReactNode }[] = useMemo(
    () => [
      { id: "scan", label: <Trans>SCAN</Trans>, content: null },
      {
        id: "manual",
        label: <Trans>MANUAL</Trans>,
        content: <ManualBarcodeEntry onSubmit={resolve} />,
      },
      {
        id: "history",
        label: <Trans>HISTORY</Trans>,
        content: (
          <ScanHistoryList
            entries={history.entries}
            onSelect={onHistorySelect}
            onClear={history.clear}
          />
        ),
      },
    ],
    [resolve, history.entries, history.clear, onHistorySelect],
  );

  return (
    // The pointerdown primer unlocks iOS AudioContext on the FIRST user gesture
    // anywhere on the page (Pitfall 4); it is idempotent so wiring it on the
    // wrapper is safe.
    <div
      className="mx-auto flex max-w-[560px] flex-col gap-sp-4"
      onPointerDown={feedback.primeAudio}
    >
      <Window title={t`SCAN`} titlebarVariant="blue">
        {/* PERSISTENT camera layer — mounted once, CSS-toggled, NEVER unmounted.
            Visible only on the Scan tab; the banner + overlays + torch render on
            top of it. When the camera is blocked we swap the live frame for the
            recovery empty-state (but keep the same wrapper so a later permission
            grant could re-show it without a remount of the page). */}
        <div className={activeTab === "scan" ? "" : "hidden"}>
          {cameraBlocked ? (
            <RetroEmptyState
              glyph="⛔"
              heading={<Trans>CAMERA BLOCKED</Trans>}
              body={
                <Trans>
                  We couldn't access the camera. Enter the code by hand instead.
                </Trans>
              }
              action={{
                label: <Trans>SWITCH TO MANUAL</Trans>,
                onClick: switchToManual,
              }}
            />
          ) : (
            <div className="relative aspect-square w-full overflow-hidden border-2 border-border-ink bg-fg-ink">
              <BarcodeScanner
                paused={paused}
                onDecode={resolve}
                onError={handleCameraError}
                torchSupported={torch.supported}
                torchEnabled={torch.enabled}
              />
              <ScanViewfinderOverlay />
              {/* Torch toggle renders only when supported (iOS auto-hide). */}
              <div className="absolute right-sp-2 top-sp-2">
                <ScanTorchToggle
                  supported={torch.supported}
                  enabled={torch.enabled}
                  onToggle={torch.toggle}
                />
              </div>
            </div>
          )}

          {/* 4-state result banner — rendered OVER the camera once a code is in
              flight. MATCH ▸ ACTIONS opens the quick-action menu (camera stays
              mounted); ERROR ↻ TRY AGAIN re-fires; NOT FOUND links to create. */}
          {showBanner && (
            <div className="mt-sp-3">
              <ScanResultBanner
                status={status}
                code={banner.code}
                item={effectiveItem}
                onOpenActions={openActions}
                onRetry={retry}
              />
            </div>
          )}
        </div>

        {/* Overlay tabs: the Scan tab is an empty spacer; Manual + History hold
            the real surfaces. Switching tabs only CSS-toggles the camera above. */}
        <div className="mt-sp-3">
          <RetroTabs tabs={tabs} value={activeTab} onChange={setTab} />
        </div>
      </Window>

      {/* Quick-action overlay (RetroDialog) — MATCH only, camera stays mounted. */}
      {status === "match" && actionsOpen && effectiveItem && (
        <QuickActionMenu item={effectiveItem} onClose={closeActions} />
      )}
    </div>
  );
}
