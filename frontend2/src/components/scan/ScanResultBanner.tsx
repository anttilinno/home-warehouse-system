// frontend2/src/components/scan/ScanResultBanner.tsx
//
// Phase 65 widening (D-17..D-21). Four mutually-exclusive states driven by
// lookupStatus + match:
//   LOADING (D-20)   — lookupStatus="loading" (or idle fallback)
//   MATCH   (D-18)   — lookupStatus="success" + match !== null
//   NOT-FOUND (D-19) — lookupStatus="success" + match === null
//   ERROR   (D-21)   — lookupStatus="error"
//
// Phase 64 precedent: single "SCANNED" state with yellow stripe + code echo
// + format pill + timestamp + SCAN AGAIN. The Phase 65 MATCH state preserves
// the format pill + timestamp + SCAN AGAIN invariants; the stripe is now
// state-driven (yellow for NOT-FOUND, red for ERROR, none for LOADING/MATCH).
//
// The callsite in ScanPage.tsx is updated in Plan 65-07 to pass the new
// props; in Plan 65-06 (this file) the component ships standalone with full
// test coverage for every state.
//
// Phase 66 REPLACES this component wholesale with QuickActionMenu — prop
// growth here is bounded + throwaway by design.
//
// Threat model refs:
// - T-65-06-01 (XSS): React JSX auto-escapes {match.name}, {match.short_code}, {code}
// - T-65-06-02 (motion sickness): the retro-cursor-blink keyframe has a
//   prefers-reduced-motion: reduce guard in globals.css (Plan 65-06 Task 2)
// - T-65-06-03 (dual-state render): `variant` is a single exclusive value
//   computed once; only one branch renders
// - T-65-06-04 (bail-out availability): SCAN AGAIN renders in every state,
//   never disabled
import { useLingui } from "@lingui/react/macro";
import { RetroPanel, RetroButton, HazardStripe } from "@/components/retro";
import { formatScanTime } from "@/lib/scanner";
import type { ScanLookupStatus } from "@/lib/api/scan";
import type { Item } from "@/lib/api/items";

export interface ScanResultBannerProps {
  code: string;
  format: string;
  timestamp: number;
  /** Drives the four-state render (D-17..D-21). */
  lookupStatus: ScanLookupStatus;
  /** Non-null iff MATCH state. */
  match: Item | null;
  onScanAgain: () => void;
  /** Rendered in MATCH state (success + match !== null). */
  onViewItem?: (itemId: string) => void;
  /** Rendered in NOT-FOUND (success + match === null) and ERROR states. */
  onCreateWithBarcode?: (code: string) => void;
  /** Rendered in ERROR state. */
  onRetry?: () => void;
}

type BannerVariant = "loading" | "match" | "not-found" | "error";

export function ScanResultBanner({
  code,
  format,
  timestamp,
  lookupStatus,
  match,
  onScanAgain,
  onViewItem,
  onCreateWithBarcode,
  onRetry,
}: ScanResultBannerProps) {
  const { t } = useLingui();

  // Mutually-exclusive variant derivation. Idle falls back to "loading"
  // visuals so the scanner never shows a stale banner (T-65-06-03).
  const variant: BannerVariant =
    lookupStatus === "loading"
      ? "loading"
      : lookupStatus === "error"
        ? "error"
        : lookupStatus === "success"
          ? match
            ? "match"
            : "not-found"
          : "loading";

  const stripe: "red" | "yellow" | null =
    variant === "error"
      ? "red"
      : variant === "not-found"
        ? "yellow"
        : null;

  const heading =
    variant === "loading"
      ? t`LOOKING UP…`
      : variant === "match"
        ? t`MATCHED`
        : variant === "not-found"
          ? t`NOT FOUND`
          : t`LOOKUP FAILED`;

  return (
    <RetroPanel>
      {stripe && <HazardStripe variant={stripe} className="mb-md" />}
      <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
        {heading}
        {variant === "loading" && (
          <span className="retro-cursor-blink ml-xs" aria-hidden="true">
            ▍
          </span>
        )}
      </h2>

      <div className="flex flex-col gap-sm">
        {variant === "match" && match && (
          <>
            <div className="flex items-center gap-md flex-wrap">
              <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
                {t`NAME`}
              </span>
              <span className="font-mono font-bold text-[24px] text-retro-ink break-all">
                {match.name}
              </span>
            </div>
            <div className="flex items-center gap-md flex-wrap">
              <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
                {t`CODE`}
              </span>
              <span className="font-mono font-bold text-[24px] text-retro-ink break-all">
                {match.short_code}
              </span>
            </div>
          </>
        )}

        {variant !== "match" && (
          <div className="flex items-center gap-md flex-wrap">
            <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
              {t`CODE`}
            </span>
            <span
              className={
                variant === "loading"
                  ? "font-mono font-bold text-[24px] text-retro-charcoal/60 break-all"
                  : "font-mono font-bold text-[24px] text-retro-ink break-all"
              }
            >
              {code}
            </span>
          </div>
        )}

        {(variant === "match" || variant === "not-found" || variant === "loading") && (
          <div className="flex items-center gap-md flex-wrap">
            <span className="font-mono font-bold uppercase text-[14px] text-retro-charcoal">
              {t`FORMAT`}
            </span>
            <span
              data-testid="scan-format-pill"
              className="font-mono text-[12px] uppercase border-retro-thick border-retro-ink bg-retro-amber text-retro-ink px-sm py-xs"
            >
              {format}
            </span>
          </div>
        )}

        {variant === "not-found" && (
          <p className="font-sans text-[14px] text-retro-ink">
            {t`No item in this workspace matches this barcode.`}
          </p>
        )}

        {variant === "error" && (
          <p className="font-sans text-[14px] text-retro-ink">
            {t`Could not reach the server. Check your connection and retry, or create a new item with this barcode.`}
          </p>
        )}

        {variant === "match" && (
          <p className="font-mono text-[14px] text-retro-charcoal">
            {formatScanTime(timestamp)}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-md justify-end mt-md">
        {variant === "match" && onViewItem && match && (
          <RetroButton variant="primary" onClick={() => onViewItem(match.id)}>
            {t`VIEW ITEM`}
          </RetroButton>
        )}
        {variant === "error" && onRetry && (
          <RetroButton variant="primary" onClick={onRetry}>
            {t`RETRY`}
          </RetroButton>
        )}
        {(variant === "not-found" || variant === "error") && onCreateWithBarcode && (
          <RetroButton variant="primary" onClick={() => onCreateWithBarcode(code)}>
            {t`CREATE ITEM WITH THIS BARCODE`}
          </RetroButton>
        )}
        <RetroButton variant="primary" onClick={onScanAgain}>
          {t`SCAN AGAIN`}
        </RetroButton>
      </div>
    </RetroPanel>
  );
}
