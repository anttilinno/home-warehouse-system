import { Fragment } from "react";
import { Link } from "react-router";
import { Trans } from "@lingui/react/macro";
import type { Crumb } from "./breadcrumbs";
import { Clock } from "./Clock";

// PageHeader (SHELL-05): rendered at the top of `main`, above route content.
// A route breadcrumb (ancestors muted+linked, leaf ink, joined by an ink "›")
// on the left; a right-aligned SESSION · LAST SYNC meta line. SESSION reuses the
// Clock leaf (single-readout `local={false}` mode) so the 1s tick re-renders
// only the clock, never this header. LAST SYNC binds to live SSE (Phase 6).

// Em-dash placeholder for LAST SYNC until a live value arrives.
const LAST_SYNC_PLACEHOLDER = "—";

const CRUMB_LINK =
  "text-fg-muted hover:text-fg-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-border-ink focus-visible:outline-offset-2";

export interface PageHeaderProps {
  /** Breadcrumb chain, ancestor-first. Ancestors with a `to` render as links. */
  crumbs: Crumb[];
  /** Live last-sync time; defaults to the "—" placeholder this phase. */
  lastSync?: string;
}

export function PageHeader({
  crumbs,
  lastSync = LAST_SYNC_PLACEHOLDER,
}: Readonly<PageHeaderProps>) {
  const lastIndex = crumbs.length - 1;

  return (
    <div className="flex items-baseline justify-between gap-sp-4 border-b-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-sp-1 text-11 font-bold uppercase tracking-10"
      >
        {crumbs.map((crumb, i) => {
          const isLeaf = i === lastIndex;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: crumb chain is positional and rebuilt wholesale per route; labels are opaque <Trans> nodes and `to` repeats across crumbs, so the index IS the identity.
            <Fragment key={i}>
              {i > 0 && (
                <span aria-hidden="true" className="text-fg-ink">
                  ›
                </span>
              )}
              {!isLeaf && crumb.to ? (
                <Link to={crumb.to} className={CRUMB_LINK}>
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLeaf ? "page" : undefined}
                  className={isLeaf ? "text-fg-ink" : "text-fg-muted"}
                >
                  {crumb.label}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>

      {/* SESSION · LAST SYNC is decorative chrome; hidden below lg so the
          breadcrumb + content column never overflow on narrow viewports
          (POL-05 — the meta cluster is ~410px and won't shrink). */}
      <div className="hidden items-center gap-sp-3 font-mono text-12 tabular-nums text-fg-muted lg:flex">
        {/* SESSION readout reuses the isolated Clock leaf (no second timer). */}
        <Clock local={false} />
        <span className="inline-flex items-center gap-sp-1">
          <span className="text-11 font-bold uppercase tracking-10 text-fg-muted">
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
