import { Link } from "react-router";
import { Trans } from "@lingui/react/macro";
import { Window, RetroBadge } from "@/components/retro";
import { usePendingChangesQuery } from "../hooks/usePendingChangesQuery";

// Phase 13 Plan 02 — the Pending Approvals side-rail card (DASH-03). STANDALONE:
// it does NOT import DashboardPage; Plan 13-05 (W2) mounts it into the side rail.
//
// Degrade discipline (ORCHESTRATOR OQ2 / threats T-13-04+05):
//   * isForbidden (403, non-admin)  → render NOTHING (return null). No banner,
//     no count — the panel must not leak the existence/volume of pending work.
//   * isError (non-403)             → ALSO render nothing — the dashboard must
//     never spam an error for a best-effort side-rail card.
//   * isLoading                     → a calm mono "Loading…" line (never a crash).
//   * total === 0                   → a calm "Nothing pending" state.
//   * total > 0                     → the count + a link to the approvals page.
//
// The /approvals route does not exist on this branch yet (no Route declared in
// src/routes/index.tsx). The link points at /approvals as the forward seam — a
// future plan lands that page; until then it falls through to PlaceholderShell.
// See SUMMARY for the mount/route follow-up.

// Bevel-styled <Link> — BevelButton is a plain <button> (no polymorphic `as`),
// so the navigational affordance reuses its bevel chrome on an anchor to stay a
// real link (role="link", open-in-tab). Mirrors InventoryPanel's BEVEL_LINK.
const BEVEL_LINK =
  "inline-flex cursor-pointer items-center justify-center gap-sp-2 border-2 border-border-ink px-[14px] py-[6px] font-body text-[13px] font-semibold uppercase tracking-[0.04em] bg-bg-panel text-fg-ink bevel-raised-ink hover:brightness-103 active:translate-x-px active:translate-y-px active:bg-bg-pressed active:bevel-pressed";

export function PendingApprovalsPanel() {
  const { total, isLoading, isError, isForbidden } = usePendingChangesQuery();

  // Silent degrade: a 403 (non-admin) OR any other error renders nothing — the
  // side-rail card simply does not appear, no banner, no leak.
  if (isForbidden || isError) {
    return null;
  }

  return (
    <Window title={<Trans>Pending approvals</Trans>} titlebarVariant="butter">
      {isLoading ? (
        <p className="font-mono text-[12px] text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      ) : total > 0 ? (
        <div className="flex items-center justify-between gap-sp-3">
          <div className="flex items-center gap-sp-2">
            <span className="font-mono text-[24px] font-bold leading-none text-fg-ink">
              {total}
            </span>
            <RetroBadge variant="warn">
              <Trans>pending</Trans>
            </RetroBadge>
          </div>
          <Link to="/approvals" className={BEVEL_LINK}>
            <Trans>Review</Trans>
          </Link>
        </div>
      ) : (
        <p className="font-mono text-[12px] text-fg-muted">
          <Trans>Nothing pending</Trans>
        </p>
      )}
    </Window>
  );
}
