import { Link } from "react-router";
import { Trans } from "@lingui/react/macro";
import { StatusPill, type StatusPillVariant } from "@/components/retro";
import type { Item } from "@/lib/types";

// SCAN-08 — the 4-state result banner. PRESENTATIONAL: it takes the resolved
// status (from 11-03's useScanResolve query) + the scanned code + the matched
// item, and renders the matching state. It owns NO query.
export type ScanBannerStatus = "loading" | "match" | "not-found" | "error";

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
};

const BEVEL_BTN =
  "inline-flex cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink px-[14px] py-[6px] font-body text-[13px] font-semibold uppercase tracking-[0.04em] bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed";

export function ScanResultBanner({
  status,
  code,
  item,
  onOpenActions,
  onRetry,
}: ScanResultBannerProps) {
  const s = STATE[status];

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
        </StatusPill>
        <span aria-hidden="true" className="text-[14px] text-fg-ink">
          {s.glyph}
        </span>
        {status === "match" && item ? (
          <span className="font-body text-[14px] text-fg-ink">{item.name}</span>
        ) : status === "error" ? (
          <span className="font-body text-[14px] text-fg-ink">
            <Trans>Couldn't look up that code.</Trans>
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-sp-3">
        <span className="font-mono text-[14px] tabular-nums text-fg-ink">
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
            ▸ <Trans>ACTIONS</Trans>
          </button>
        )}
        {status === "not-found" && (
          <Link
            to={`/items/new?barcode=${encodeURIComponent(code)}`}
            className={BEVEL_BTN}
          >
            ⊕ <Trans>CREATE WITH CODE</Trans>
          </Link>
        )}
        {status === "error" && (
          <button type="button" className={BEVEL_BTN} onClick={onRetry}>
            ↻ <Trans>TRY AGAIN</Trans>
          </button>
        )}
      </div>
    </section>
  );
}
