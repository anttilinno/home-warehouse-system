import { useQuery } from "@tanstack/react-query";
import { Trans, useLingui } from "@lingui/react/macro";
import { get } from "@/lib/api";
import { i18n } from "@/lib/i18n";
import type {
  DashboardStats,
  RecentActivity,
  User,
  Workspace,
} from "@/lib/types";
import { BrandMark } from "@/components/BrandMark";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  RetroBadge,
  RetroTable,
  StatCard,
  Window,
  type RetroBadgeVariant,
} from "@/components/retro";

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

// Activity rows can be days old — show the date once the event isn't from
// today, or HH:MM alone reads as "today" and misleads.
function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return date.toLocaleString(i18n.locale, {
    ...(sameDay ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Retro-os sample dashboard (sketch 006): stat windows over real
// DashboardStats + RecentActivity. Workspace switcher, sidebar, and full
// chrome are Phase 3/5 scope — this binds the aesthetic to real backend
// data with the first workspace. Auth guard lives in RequireAuth (route).
export function DashboardPage() {
  const { t } = useLingui();

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => get<Workspace[]>("/users/me/workspaces"),
    retry: false,
  });
  const wsId = workspaces.data?.[0]?.id;

  const stats = useQuery({
    queryKey: ["dashboard", wsId],
    queryFn: () => get<DashboardStats>(`/workspaces/${wsId}/analytics/dashboard`),
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
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => get<User>("/users/me"),
    retry: false,
  });

  if (workspaces.data && workspaces.data.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center p-sp-4">
        <Window title={<Trans>No workspace</Trans>} titlebarVariant="butter">
          <p className="text-[13px]">
            <Trans>Your account has no workspaces yet.</Trans>
          </p>
        </Window>
      </main>
    );
  }

  const s = stats.data;

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-sp-5 p-sp-5 md:grid-cols-[232px_1fr]">
      <aside className="md:sticky md:top-sp-5">
        <Sidebar stats={s} user={me.data} />
      </aside>

      <main className="min-w-0">
      <header className="mb-sp-5 flex items-baseline gap-sp-3">
        <h1>
          <BrandMark />
        </h1>
        <span className="font-mono text-[12px] text-fg-muted">
          {workspaces.data?.[0]?.name}
        </span>
      </header>

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
            className="flex items-baseline justify-between gap-sp-2 border-2 border-border-ink bg-bg-panel px-sp-3 py-sp-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-fg-muted bevel-raised-ink"
          >
            {label}
            <b className="font-mono text-[16px] text-fg-ink">{count ?? "—"}</b>
          </div>
        ))}
      </section>

      <Window
        title={<Trans>Recent activity</Trans>}
        actions={<span className="font-mono text-[11px]">limit=10</span>}
        bodyClassName=""
      >
        {!activity.data && !activity.isError && (
          <p className="p-sp-4 font-mono text-[13px] text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}
        {activity.isError && (
          <p className="p-sp-4 text-[13px] font-semibold text-danger">
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
                  <Trans>Name</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {activity.data.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{formatActivityTime(row.created_at)}</td>
                  <td>
                    <RetroBadge
                      variant={
                        ACTION_BADGES[row.action.toUpperCase()] ?? "neutral"
                      }
                    >
                      {row.action}
                    </RetroBadge>
                  </td>
                  <td>{row.entity_type}</td>
                  <td>{row.entity_name}</td>
                </tr>
              ))}
              {activity.data.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-fg-muted">
                    <Trans>No activity yet.</Trans>
                  </td>
                </tr>
              )}
            </tbody>
          </RetroTable>
        )}
      </Window>
      </main>
    </div>
  );
}
