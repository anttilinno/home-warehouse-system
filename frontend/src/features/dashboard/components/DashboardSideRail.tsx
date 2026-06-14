import { PendingApprovalsPanel } from "@/features/approvals/components/PendingApprovalsPanel";
import { SystemAlertsPanel } from "./SystemAlertsPanel";

// DASH-03: the dashboard side-rail container. Presentational only — a vertical
// stack of PendingApprovals (Plan 13-02) ABOVE SystemAlerts (this plan), with a
// gap-sp-4 rhythm. NO data fetching here; pure composition, no required props.
//
// Layout-light by design: this container is just the vertical stack. The page
// (Plan 13-05, Wave 2) owns the responsive 2-column → 1-column switch — the rail
// is the right column on wide layouts and drops below the main column when narrow.
export function DashboardSideRail() {
  return (
    <div className="flex flex-col gap-sp-5">
      <PendingApprovalsPanel />
      <SystemAlertsPanel />
    </div>
  );
}
