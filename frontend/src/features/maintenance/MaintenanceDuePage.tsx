import { useState, type ReactNode } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  RetroTable,
  RetroEmptyState,
  StatusPill,
} from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { DueSchedule } from "@/lib/types";
import { useMaintenanceDueQuery } from "./hooks/useMaintenanceQuery";
import { CompleteMaintenanceDialog } from "./components/CompleteMaintenanceDialog";

// Phase 10b Plan 04 — the /maintenance/due attention surface (MNT-02). A MINT
// Window (inventory-family list) titled `DUE MAINTENANCE — {workspace}`, backed
// by useMaintenanceDueQuery (the Phase-13 feed hook). RetroTable columns Item /
// Schedule / Next due / Status + a COMPLETE action.
//
// Overdue treatment is driven ENTIRELY by the SERVER `is_overdue` flag (override
// #3 — NEVER client `next_due < now` math). An overdue row carries THREE
// non-color cues: a danger row tint (bg-danger-bg), a danger `Overdue` StatusPill
// (the word is the cue), and a ⚠-prefixed danger next-due chip. On-time rows
// render a plain mono next_due + an ok `Due` pill.

function isoDate(value?: string): string {
  return value ? value.slice(0, 10) : "—";
}

export function MaintenanceDuePage() {
  const { t } = useLingui();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();
  const { items, isLoading, isError } = useMaintenanceDueQuery();

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  const [completeTarget, setCompleteTarget] = useState<DueSchedule | null>(
    null,
  );

  // Next-due cell — the server flag picks the cue (the third, ⚠-chip cue).
  function renderNextDue(row: DueSchedule): ReactNode {
    if (row.is_overdue) {
      return (
        <span className="inline-flex items-center gap-[4px] rounded-chip border border-border-ink bg-danger-bg px-sp-2 py-px font-mono text-12 font-bold tabular-nums text-danger">
          <span aria-hidden="true">⚠</span>
          {isoDate(row.next_due)}
        </span>
      );
    }
    return (
      <span className="font-mono tabular-nums text-fg-muted">
        {isoDate(row.next_due)}
      </span>
    );
  }

  const showEmpty = !isLoading && !isError && items.length === 0;

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window
        title={t`DUE MAINTENANCE — ${workspaceName}`}
        titlebarVariant="mint"
        bodyClassName=""
      >
        {isLoading && (
          <p className="p-sp-4 font-mono text-13 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-13 font-semibold text-danger">
            <Trans>Couldn't load maintenance. Try again.</Trans>
          </p>
        )}

        {showEmpty && (
          <div className="p-sp-4">
            <RetroEmptyState
              eyebrow={<Trans>Maintenance</Trans>}
              glyph="◇"
              heading={<Trans>NOTHING DUE</Trans>}
              body={
                <Trans>
                  No maintenance is due right now. You're all caught up.
                </Trans>
              }
            />
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <RetroTable>
            <thead>
              <tr>
                <th>{t`Item`}</th>
                <th>{t`Schedule`}</th>
                <th>{t`Next due`}</th>
                <th>{t`Status`}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className={row.is_overdue ? "bg-danger-bg" : ""}
                >
                  <td className="font-semibold">{row.item_name}</td>
                  <td className="font-semibold">{row.title}</td>
                  <td className="font-mono">{renderNextDue(row)}</td>
                  <td>
                    <StatusPill variant={row.is_overdue ? "danger" : "ok"}>
                      {row.is_overdue ? (
                        <Trans>Overdue</Trans>
                      ) : (
                        <Trans>Due</Trans>
                      )}
                    </StatusPill>
                  </td>
                  <td className="actions text-right">
                    <BevelButton
                      className="!px-[8px] !py-[2px] !text-11"
                      onClick={() => setCompleteTarget(row)}
                    >
                      <Trans>COMPLETE</Trans>
                    </BevelButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </RetroTable>
        )}
      </Window>

      {/* Complete confirm — on success the row's next_due advances past the
          window and the prefix-invalidate drops it from the due list. */}
      {completeTarget && (
        <CompleteMaintenanceDialog
          key={completeTarget.id}
          open
          schedule={completeTarget}
          onClose={() => setCompleteTarget(null)}
        />
      )}
    </div>
  );
}
