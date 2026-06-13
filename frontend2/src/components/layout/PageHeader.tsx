import { Fragment } from "react";
import { Trans } from "@lingui/react/macro";
import { Clock } from "./Clock";

// PageHeader (SHELL-05): rendered at the top of `main`, above route content.
// A route breadcrumb (ancestors muted, leaf ink, joined by an ink "›") on the
// left; a right-aligned SESSION · LAST SYNC meta line. SESSION reuses the Clock
// leaf (single-readout `local={false}` mode) so the 1s tick re-renders only the
// clock, never this header. LAST SYNC is an em-dash placeholder this phase — the
// slot/markup stays stable, binding to live SSE in Phase 6 (resolution #2).

// Em-dash placeholder for LAST SYNC until Phase 6 wires the live value.
const LAST_SYNC_PLACEHOLDER = "—";

export interface PageHeaderProps {
  /** Breadcrumb path, ancestor-first (e.g. ["OVERVIEW", "DASHBOARD"]). */
  segments: string[];
  /** Live last-sync time; defaults to the "—" placeholder this phase. */
  lastSync?: string;
}

export function PageHeader({
  segments,
  lastSync = LAST_SYNC_PLACEHOLDER,
}: PageHeaderProps) {
  const lastIndex = segments.length - 1;

  return (
    <div className="flex items-baseline justify-between gap-sp-4 border-b-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-sp-1 text-[11px] font-bold uppercase tracking-[0.1em]"
      >
        {segments.map((segment, i) => (
          <Fragment key={`${segment}-${i}`}>
            {i > 0 && (
              <span aria-hidden="true" className="text-fg-ink">
                ›
              </span>
            )}
            <span
              aria-current={i === lastIndex ? "page" : undefined}
              className={i === lastIndex ? "text-fg-ink" : "text-fg-muted"}
            >
              {segment}
            </span>
          </Fragment>
        ))}
      </nav>

      {/* SESSION · LAST SYNC is decorative chrome; hidden below lg so the
          breadcrumb + content column never overflow on narrow viewports
          (POL-05 — the meta cluster is ~410px and won't shrink). */}
      <div className="hidden items-center gap-sp-3 font-mono text-[12px] tabular-nums text-fg-muted lg:flex">
        {/* SESSION readout reuses the isolated Clock leaf (no second timer). */}
        <Clock local={false} />
        <span className="inline-flex items-center gap-sp-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-fg-muted">
            <Trans>LAST SYNC</Trans>
          </span>
          <span
            data-testid="page-header-lastsync"
            className="tabular-nums text-fg-ink"
          >
            {lastSync}
          </span>
        </span>
      </div>
    </div>
  );
}
