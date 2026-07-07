import { Trans } from "@lingui/react/macro";
import { RetroEmptyState } from "@/components/retro";
import { useDateFormat, useTimeFormat } from "@/lib/format";
import type { Movement } from "@/lib/types";

// Phase 7b Plan 02 — the per-entry movement history list (UI-SPEC §6). A
// recessed bg-bg-panel-2 strip; each row is mono (tabular-nums) with a
// timestamp, a from→to path, a ×qty, and the mover. Null from_* (initial
// placement) renders `— → {to}`. An empty list renders the NO MOVEMENTS empty
// state. The component is presentational: the drawer feeds it the resolved
// movement list (the data hook lives in MovementsDrawer).

export interface MovementsPanelProps {
  movements: Movement[];
  /** Optional member resolver for the "who" column (UUID → display name). */
  resolveMember?: (id: string) => string | undefined;
  /** Optional location resolver so from/to render names instead of UUIDs. */
  resolveLocation?: (id: string) => string | undefined;
  isLoading?: boolean;
}

export function MovementsPanel({
  movements,
  resolveMember,
  resolveLocation,
  isLoading,
}: Readonly<MovementsPanelProps>) {
  // I18N-03: the movement timestamp (was a hand-rolled UTC `YYYY-MM-DD HH:mm`)
  // now honors the user's date_format + time_format preference. The format hooks
  // still decompose in UTC under the hood (tokens.ts), preserving this panel's
  // original convention.
  const formatDate = useDateFormat();
  const formatTime = useTimeFormat();
  if (isLoading) {
    return (
      <p className="bg-bg-panel-2 p-sp-4 font-mono text-12 text-fg-muted">
        <Trans>Loading…</Trans>
      </p>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="bg-bg-panel-2 p-sp-3">
        <RetroEmptyState
          eyebrow={<Trans>Movements</Trans>}
          glyph="reload"
          heading={<Trans>NO MOVEMENTS</Trans>}
          body={<Trans>This item hasn't been moved yet.</Trans>}
        />
      </div>
    );
  }

  const label = (id?: string) =>
    id ? (resolveLocation?.(id) ?? id) : undefined;

  return (
    <div className="bg-bg-panel-2">
      <h4 className="mx-sp-3 mb-sp-1 pt-sp-2 text-10 font-bold uppercase tracking-14 text-fg-muted">
        <Trans>Movements</Trans>
      </h4>
      <ul>
        {movements.map((m) => {
          const from = label(m.from_location_id);
          const to = label(m.to_location_id) ?? "—";
          const who = m.moved_by ? (resolveMember?.(m.moved_by) ?? null) : null;
          return (
            <li
              key={m.id}
              className="flex flex-wrap items-baseline gap-sp-2 border-b border-table-rule px-sp-3 py-sp-2 font-mono text-12 tabular-nums"
            >
              <span className="text-fg-muted">
                {formatDate(m.created_at)} {formatTime(m.created_at)}
              </span>
              <span className="text-fg-ink">
                {from ?? "—"} <span aria-hidden="true">→</span> {to}
              </span>
              <span className="ml-auto text-fg-ink">×{m.quantity}</span>
              <span className="text-fg-muted">
                {who ?? <Trans>Unknown</Trans>}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
