import { Trans } from "@lingui/react/macro";
import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  PixelIcon,
  StatusPill,
  type StatusPillVariant,
} from "@/components/retro";
import type { Item } from "@/lib/types";

// SCAN-08 — the 5-state result banner. PRESENTATIONAL: it takes the resolved
// status (from 11-03's useScanResolve query, offline-aware since Phase 4) +
// the scanned code + the matched item, and renders the matching state. It owns
// NO query.
//
// "offline" (Phase 4): a new/uncached code can't be resolved because the
// device has no network — distinct from "error" (a real request failed while
// online, e.g. a 500). Offers the SAME two add-anyway actions as "not-found"
// (a code cached from a prior online scan still resolves to match/not-found
// from the persisted query cache, even offline — see ScanPage's bannerStatus).
export type ScanBannerStatus =
  | "loading"
  | "match"
  | "not-found"
  | "error"
  | "offline";

export interface ScanResultBannerProps {
  status: ScanBannerStatus;
  /** The scanned/looked-up code (echoed in mono; user-controlled). */
  code: string;
  /** The matched item (MATCH state only). */
  item?: Item | null;
  /** MATCH: open the quick-action overlay. */
  onOpenActions?: () => void;
  /** ERROR: re-fire the same code. */
  onRetry?: () => void;
}

// Three cues per state: a StatusPill variant + a unicode glyph + the Silkscreen
// state word (the pill text IS the word). Tints carry ink text (AA holds).
const STATE: Record<
  ScanBannerStatus,
  { pill: StatusPillVariant; glyph: string; tint: string }
> = {
  loading: { pill: "info", glyph: "◌", tint: "bg-bg-panel-2" },
  match: { pill: "ok", glyph: "✓", tint: "bg-titlebar-mint" },
  "not-found": { pill: "warn", glyph: "✕", tint: "bg-titlebar-butter" },
  error: { pill: "danger", glyph: "✕", tint: "bg-danger-bg" },
  offline: { pill: "warn", glyph: "⚠", tint: "bg-bg-panel-2" },
};

const BEVEL_BTN =
  "inline-flex cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink px-[14px] py-[6px] font-body text-13 font-semibold uppercase tracking-4 bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed";

export function ScanResultBanner({
  status,
  code,
  item,
  onOpenActions,
  onRetry,
}: Readonly<ScanResultBannerProps>) {
  const s = STATE[status];

  let headline: ReactNode = null;
  if (status === "match" && item) {
    headline = (
      <span className="font-body text-14 text-fg-ink">{item.name}</span>
    );
  } else if (status === "error") {
    headline = (
      <span className="font-body text-14 text-fg-ink">
        <Trans>Couldn't look up that code.</Trans>
      </span>
    );
  } else if (status === "offline") {
    headline = (
      <span className="font-body text-14 text-fg-ink">
        <Trans>Can't verify offline. Add anyway?</Trans>
      </span>
    );
  }

  return (
    <section
      aria-live="polite"
      className={`flex flex-col gap-sp-2 border-2 border-border-ink p-sp-3 ${s.tint}`}
    >
      <div className="flex items-center gap-sp-2">
        <StatusPill variant={s.pill}>
          {status === "loading" && <Trans>LOADING</Trans>}
          {status === "match" && <Trans>MATCH</Trans>}
          {status === "not-found" && <Trans>NOT FOUND</Trans>}
          {status === "error" && <Trans>ERROR</Trans>}
          {status === "offline" && <Trans>OFFLINE</Trans>}
        </StatusPill>
        <span aria-hidden="true" className="text-14 text-fg-ink">
          {s.glyph}
        </span>
        {headline}
      </div>

      <div className="flex items-center justify-between gap-sp-3">
        <span className="font-mono text-14 tabular-nums text-fg-ink">
          {code}
          {status === "loading" && (
            <span
              data-testid="scan-cursor"
              aria-hidden="true"
              className="scan-cursor--blink ml-sp-1 inline-block"
            >
              ▏
            </span>
          )}
        </span>

        {status === "match" && (
          <button type="button" className={BEVEL_BTN} onClick={onOpenActions}>
            <PixelIcon name="chevron-right" size={16} /> <Trans>ACTIONS</Trans>
          </button>
        )}
        {(status === "not-found" || status === "offline") && (
          <span className="flex flex-wrap items-center gap-sp-2">
            {/* Unknown (or unverifiable-offline) code → let the user register
                it as an item (code → barcode) or a container (code →
                short_code). Offline, the create becomes a queued write
                (Phase 3/4 offline mutations) that replays on reconnect. */}
            <Link
              to={`/items/new?barcode=${encodeURIComponent(code)}`}
              className={BEVEL_BTN}
            >
              <PixelIcon name="plus" size={16} /> <Trans>ITEM</Trans>
            </Link>
            <Link
              to={`/taxonomy?tab=containers&new_code=${encodeURIComponent(code)}`}
              className={BEVEL_BTN}
            >
              <PixelIcon name="folder" size={16} /> <Trans>CONTAINER</Trans>
            </Link>
          </span>
        )}
        {status === "error" && (
          <button type="button" className={BEVEL_BTN} onClick={onRetry}>
            <PixelIcon name="reload" size={16} /> <Trans>TRY AGAIN</Trans>
          </button>
        )}
      </div>
    </section>
  );
}
