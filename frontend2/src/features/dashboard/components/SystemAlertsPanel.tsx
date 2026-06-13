import { Link } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { Window, RetroBadge } from "@/components/retro";
import { useExpiringQuery } from "@/features/inventory/hooks/useExpiringQuery";
import { useMaintenanceDueQuery } from "@/features/maintenance/hooks/useMaintenanceQuery";

// DASH-03 (part 2): the System Alerts side-rail panel. Stacks two summary cards
// that REUSE the existing Phase-7b / Phase-10b reads — it builds NO new api or
// hook:
//  - expiring items via useExpiringQuery (the /inventory/expiring read)
//  - due/overdue maintenance via useMaintenanceDueQuery (the Phase-13 dashboard
//    feed hook). The OVERDUE cue renders the SERVER `is_overdue` flag verbatim —
//    never client date math (T-13-06).
// Each card degrades to a calm zero / loading / error state and never crashes
// on empty. STANDALONE — Plan 13-05 mounts it (via DashboardSideRail).

interface AlertCardProps {
  label: React.ReactNode;
  to: string;
  /** Resolved count, or null while loading / on error (calm degrade). */
  count: number | null;
  isLoading: boolean;
  isError: boolean;
  /** Calm one-liner shown when the count resolves to 0. */
  emptyText: React.ReactNode;
  /** Optional trailing slot (e.g. an overdue danger badge). */
  trailing?: React.ReactNode;
}

function AlertCard({
  label,
  to,
  count,
  isLoading,
  isError,
  emptyText,
  trailing,
}: AlertCardProps) {
  const { t } = useLingui();

  // Loading → calm mono "Loading…"; error → calm "—" (no error spam).
  const display = isLoading
    ? t`Loading…`
    : isError || count === null
      ? "—"
      : String(count);

  const resolvedZero = !isLoading && !isError && count === 0;

  return (
    <Link
      to={to}
      className="flex items-center justify-between gap-sp-3 border-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2 no-underline"
    >
      <span className="flex flex-col gap-px">
        <span className="font-display text-[13px] uppercase tracking-[0.02em] text-fg-ink">
          {label}
        </span>
        {resolvedZero && (
          <span className="text-[12px] text-fg-muted">{emptyText}</span>
        )}
      </span>
      <span className="flex items-center gap-sp-2">
        {trailing}
        <span className="font-mono text-[18px] font-bold tabular-nums text-fg-ink">
          {display}
        </span>
      </span>
    </Link>
  );
}

export function SystemAlertsPanel() {
  const expiring = useExpiringQuery();
  const maintenance = useMaintenanceDueQuery();

  const expiringCount = expiring.data?.total ?? expiring.data?.items.length ?? 0;
  const dueCount = maintenance.items.length;
  const overdueCount = maintenance.items.filter((i) => i.is_overdue).length;

  return (
    <Window title={<Trans>System alerts</Trans>} titlebarVariant="butter">
      <div className="flex flex-col gap-sp-3">
        <AlertCard
          label={<Trans>Expiring soon</Trans>}
          to="/inventory/expiring"
          count={expiring.isSuccess ? expiringCount : null}
          isLoading={expiring.isLoading}
          isError={expiring.isError}
          emptyText={<Trans>Nothing expiring</Trans>}
        />
        <AlertCard
          label={<Trans>Maintenance due</Trans>}
          to="/maintenance/due"
          count={maintenance.isLoading || maintenance.isError ? null : dueCount}
          isLoading={maintenance.isLoading}
          isError={maintenance.isError}
          emptyText={<Trans>Nothing due</Trans>}
          trailing={
            overdueCount > 0 ? (
              <RetroBadge variant="danger">
                <Trans>{overdueCount} overdue</Trans>
              </RetroBadge>
            ) : undefined
          }
        />
      </div>
    </Window>
  );
}
