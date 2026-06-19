import { Trans } from "@lingui/react/macro";
import {
  RetroBadge,
  type RetroBadgeVariant,
  RetroTable,
  Window,
} from "@/components/retro";
import type { RecentActivity } from "@/lib/types";
import { formatRelativeTime } from "../relativeTime";

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

// Retro-os dashboard (sketch 006) — the Recent activity card: the loading /
// error / table switch over RecentActivity. Extracted verbatim from
// DashboardPage to lift the activity-query view branches and the row map out of
// the page body. Time is relative under 24h, absolute after (DASH-02); the
// Status pill is action-derived via ACTION_BADGES (T-13-10 — no server status).
export function RecentActivityCard({
  data,
  isError,
}: Readonly<{ data: RecentActivity[] | undefined; isError: boolean }>) {
  return (
    <Window
      title={<Trans>Recent activity</Trans>}
      actions={<span className="font-mono text-11">limit=10</span>}
      bodyClassName=""
    >
      {!data && !isError && (
        <p className="p-sp-4 font-mono text-13 text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      )}
      {isError && (
        <p className="p-sp-4 text-13 font-semibold text-danger">
          <Trans>Could not load activity.</Trans>
        </p>
      )}
      {data && (
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
            {data.map((row) => (
              <tr key={row.id}>
                {/* DASH-02: relative under 24h, absolute after (../relativeTime). */}
                <td className="mono">{formatRelativeTime(row.created_at)}</td>
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
                    action-derived badge (T-13-10), never a fabricated status. */}
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
            {data.length === 0 && (
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
  );
}
