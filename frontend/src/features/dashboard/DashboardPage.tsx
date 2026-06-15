import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Trans, useLingui } from "@lingui/react/macro";
import { get } from "@/lib/api";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { useShortcuts } from "@/components/shortcuts";
import type { DashboardStats, RecentActivity } from "@/lib/types";
import {
  RetroBadge,
  RetroTable,
  StatCard,
  Window,
  type RetroBadgeVariant,
} from "@/components/retro";
import { DashboardSideRail } from "./components/DashboardSideRail";
import { HudRow } from "./components/HudRow";
import { formatRelativeTime } from "./relativeTime";

// Keys match warehouse.activity_action_enum verbatim (CREATE/UPDATE/DELETE/
// MOVE/LOAN/RETURN — db/schema.sql); the backend returns action unmapped.
const ACTION_BADGES: Record<string, RetroBadgeVariant> = {
  CREATE: "ok",
  UPDATE: "warn",
  DELETE: "danger",
  MOVE: "info",
  LOAN: "info",
  RETURN: "info",
};

// Activity rows can be days old. DASH-02: under 24h reads as a relative
// interval ("Nm ago" / "Nh ago"), at/after 24h falls back to an absolute
// date+time so older rows never read as "today". The formatter is the standalone
// ./relativeTime util (unit-tested at the boundaries).

// Retro-os dashboard (sketch 006): the stat windows + recent-activity table
// over real DashboardStats + RecentActivity. As of Phase 3 the page lives
// INSIDE AppShell — the shell owns the chrome (TopBar, Navigator, Bottombar,
// PageHeader), so this component renders only the route body. Auth guard lives
// in RequireAuth (the AppShell layout route).
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

  if (workspaces && workspaces.length === 0) {
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
        <section className="mb-sp-5 grid grid-cols-2 gap-sp-4 lg:grid-cols-4 [&>*]:min-w-0">
          <StatCard
            label={<Trans>Items</Trans>}
            value={s?.total_items ?? "—"}
            sub={s && <Trans>{s.total_inventory} units total</Trans>}
          />
          <StatCard
            label={<Trans>Loans</Trans>}
            value={s?.active_loans ?? "—"}
            sub={<Trans>active</Trans>}
            titlebarVariant="mint"
          />
          <StatCard
            label={<Trans>Overdue</Trans>}
            value={s?.overdue_loans ?? "—"}
            sub={<Trans>action needed</Trans>}
            titlebarVariant="pink"
            valueTone={s && s.overdue_loans > 0 ? "danger" : "ink"}
          />
          <StatCard
            label={<Trans>Low stock</Trans>}
            value={s?.low_stock_items ?? "—"}
            sub={<Trans>below threshold</Trans>}
            titlebarVariant="butter"
            valueTone={s && s.low_stock_items > 0 ? "warn" : "ink"}
          />
        </section>

        <section className="mb-sp-5 grid grid-cols-2 gap-sp-4 md:grid-cols-4 [&>*]:min-w-0">
          {(
            [
              [t`Locations`, s?.total_locations],
              [t`Containers`, s?.total_containers],
              [t`Categories`, s?.total_categories],
              [t`Borrowers`, s?.total_borrowers],
            ] as const
          ).map(([label, count]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-sp-2 border-2 border-border-ink bg-bg-panel px-sp-3 py-sp-2 text-12 font-semibold uppercase tracking-6 text-fg-muted bevel-raised-ink"
            >
              {label}
              <b className="font-display text-16 text-fg-ink">{count ?? "—"}</b>
            </div>
          ))}
        </section>

        {/* DASH-04: the flag-gated HUD row (self-gates on VITE_FEATURE_HUD_ROLLUPS;
          renders null by default → the dashboard is identical to today). */}
        <div className="mb-sp-5">
          <HudRow stats={s} />
        </div>

        <Window
          title={<Trans>Recent activity</Trans>}
          actions={<span className="font-mono text-11">limit=10</span>}
          bodyClassName=""
        >
          {!activity.data && !activity.isError && (
            <p className="p-sp-4 font-mono text-13 text-fg-muted">
              <Trans>Loading…</Trans>
            </p>
          )}
          {activity.isError && (
            <p className="p-sp-4 text-13 font-semibold text-danger">
              <Trans>Could not load activity.</Trans>
            </p>
          )}
          {activity.data && (
            <RetroTable>
              <thead>
                <tr>
                  <th>
                    <Trans>Time</Trans>
                  </th>
                  <th>
                    <Trans>Action</Trans>
                  </th>
                  <th>
                    <Trans>Entity</Trans>
                  </th>
                  <th>
                    <Trans>Actor</Trans>
                  </th>
                  <th>
                    <Trans>Status</Trans>
                  </th>
                </tr>
              </thead>
              <tbody>
                {activity.data.map((row) => (
                  <tr key={row.id}>
                    {/* DASH-02: relative under 24h, absolute after (./relativeTime). */}
                    <td className="mono">
                      {formatRelativeTime(row.created_at)}
                    </td>
                    <td>{row.action}</td>
                    {/* Entity type with the entity_name folded in as a secondary
                      line so no data is lost when the Name column is dropped. */}
                    <td>
                      <span className="block">{row.entity_type}</span>
                      {row.entity_name && (
                        <span className="block text-12 text-fg-muted">
                          {row.entity_name}
                        </span>
                      )}
                    </td>
                    {/* Actor: the raw user_id slug (no actor name on the wire —
                      RecentActivity carries user_id? only). "—" when absent. */}
                    <td className="mono">
                      {row.user_id ? row.user_id.slice(0, 8) : "—"}
                    </td>
                    {/* Status: a pill DERIVED from `action` via ACTION_BADGES —
                      RecentActivity has NO status field; this is honestly an
                      action-derived badge (T-13-10), never a fabricated server
                      status. */}
                    <td>
                      <RetroBadge
                        variant={
                          ACTION_BADGES[row.action.toUpperCase()] ?? "neutral"
                        }
                      >
                        {row.action}
                      </RetroBadge>
                    </td>
                  </tr>
                ))}
                {activity.data.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-fg-muted">
                      <Trans>No activity yet.</Trans>
                    </td>
                  </tr>
                )}
              </tbody>
            </RetroTable>
          )}
        </Window>
      </div>

      {/* DASH-03: the right side rail (Pending Approvals above System Alerts).
          Self-fetches; drops below the main column on narrow (the grid above
          collapses to a single column). */}
      <DashboardSideRail />
    </div>
  );
}
