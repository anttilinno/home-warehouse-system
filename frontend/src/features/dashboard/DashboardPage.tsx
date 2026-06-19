import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { Window } from "@/components/retro";
import { useShortcuts } from "@/components/shortcuts";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { get } from "@/lib/api";
import type { DashboardStats, RecentActivity } from "@/lib/types";
import { DashboardSideRail } from "./components/DashboardSideRail";
import { DashboardStatTiles } from "./components/DashboardStatTiles";
import { RecentActivityCard } from "./components/RecentActivityCard";
import { HudRow } from "./components/HudRow";

// Retro-os dashboard (sketch 006): the stat tiles (DashboardStatTiles) + the
// recent-activity card (RecentActivityCard) over real DashboardStats +
// RecentActivity. As of Phase 3 the page lives INSIDE AppShell — the shell owns
// the chrome (TopBar, Navigator, Bottombar, PageHeader), so this component
// renders only the route body. Auth guard lives in RequireAuth (the AppShell
// layout route).
export function DashboardPage() {
  const { t } = useLingui();
  const navigate = useNavigate();

  // wsId is the D-12 SSOT — sourced from the WorkspaceProvider context, NOT a
  // first-workspace hardcode (AUTH-06). The provider already owns the shared
  // ["workspaces"] query; the dashboard reads its list for the empty-state.
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const stats = useQuery({
    queryKey: ["dashboard", wsId],
    queryFn: () =>
      get<DashboardStats>(`/workspaces/${wsId}/analytics/dashboard`),
    enabled: !!wsId,
    retry: false,
  });
  const activity = useQuery({
    queryKey: ["activity", wsId],
    queryFn: () =>
      get<RecentActivity[]>(`/workspaces/${wsId}/analytics/activity?limit=10`),
    enabled: !!wsId,
    retry: false,
  });

  // ── Route shortcuts (DASH-05): N → new item, S → scan, L → loans. Each action
  // is a stable useCallback over the stable `navigate`. Labels are translated
  // with the `t` macro DIRECTLY (the prior `tRef.current`…`` indirection broke
  // the macro transform → empty labels) and the bindings memo keys on those
  // resolved label STRINGS — primitives that are stable across renders within a
  // locale, so the register effect never loops, yet re-runs on a language switch.
  const goNew = useCallback(() => navigate("/items/new"), [navigate]);
  const goScan = useCallback(() => navigate("/scan"), [navigate]);
  const goLoans = useCallback(() => navigate("/loans"), [navigate]);
  const labelNew = t`New item`;
  const labelScan = t`Scan`;
  const labelLoans = t`Loans`;
  const routeShortcuts = useMemo(
    () => [
      { key: "N", label: labelNew, action: goNew },
      { key: "S", label: labelScan, action: goScan },
      { key: "L", label: labelLoans, action: goLoans },
    ],
    [goNew, goScan, goLoans, labelNew, labelScan, labelLoans],
  );
  useShortcuts("dashboard", routeShortcuts);

  if (workspaces?.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center p-sp-4">
        <Window title={<Trans>No workspace</Trans>} titlebarVariant="butter">
          <p className="text-13">
            <Trans>Your account has no workspaces yet.</Trans>
          </p>
        </Window>
      </main>
    );
  }

  const s = stats.data;

  return (
    <div className="mx-auto grid min-w-0 max-w-[1280px] grid-cols-1 gap-sp-5 lg:grid-cols-[1fr_320px]">
      {/* Main column: tiles → HUD → activity. The side rail (DASH-03) is the
          right column on wide layouts and drops below the main column on narrow
          (lg:grid-cols-[1fr_320px] collapses to a single column). */}
      <div className="min-w-0">
        <DashboardStatTiles stats={s} />

        {/* DASH-04: the flag-gated HUD row (self-gates on VITE_FEATURE_HUD_ROLLUPS;
          renders null by default → the dashboard is identical to today). */}
        <div className="mb-sp-5">
          <HudRow stats={s} />
        </div>

        <RecentActivityCard data={activity.data} isError={activity.isError} />
      </div>

      {/* DASH-03: the right side rail (Pending Approvals above System Alerts).
          Self-fetches; drops below the main column on narrow (the grid above
          collapses to a single column). */}
      <DashboardSideRail />
    </div>
  );
}
