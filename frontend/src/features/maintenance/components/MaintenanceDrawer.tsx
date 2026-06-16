import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  RetroDialog,
  RetroConfirmDialog,
  BevelButton,
  RetroEmptyState,
  retroToast,
} from "@/components/retro";
import { useSchedulesByInventoryQuery } from "../hooks/useMaintenanceQuery";
import { useMaintenanceMutations } from "../hooks/useMaintenanceMutations";
import { MaintenanceForm } from "./MaintenanceForm";
import { CompleteMaintenanceDialog } from "./CompleteMaintenanceDialog";
import type { MaintenanceSchedule } from "@/lib/types";

// Phase 10b Plan 04 — the per-inventory-row Maintenance drawer (MNT-01). A BLUE
// RetroDialog titled `MAINTENANCE — {item}`, a sibling of MovementsDrawer /
// RepairsDrawer: `invId === null ⇒ closed`. Body (UI-SPEC §4): an ⊕ ADD SCHEDULE
// CTA + the schedule list with per-row COMPLETE / EDIT / DELETE actions. All
// writes flow through useMaintenanceMutations.
//
// NO is_overdue in the drawer (override #3): the per-inventory endpoint returns
// plain schedules with no flag, so next_due renders as a NEUTRAL mono date —
// NEVER a client-computed overdue cue (that lives only on /maintenance/due §5).

export interface MaintenanceDrawerProps {
  /** The inventory entry whose schedules to show; null = closed. */
  invId: string | null;
  /** Display name shown in the title context (the owning item). */
  itemName?: string;
  onClose: () => void;
}

function formatDate(value?: string): string {
  return value ? value.slice(0, 10) : "—";
}

export function MaintenanceDrawer({
  invId,
  itemName,
  onClose,
}: Readonly<MaintenanceDrawerProps>) {
  const { t } = useLingui();
  const { items, isLoading, isError } = useSchedulesByInventoryQuery(invId);
  const { deleteSchedule } = useMaintenanceMutations();

  // Nested dialog state (form create/edit, complete, delete confirm).
  const [formSchedule, setFormSchedule] = useState<
    MaintenanceSchedule | null | undefined
  >(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [completeTarget, setCompleteTarget] =
    useState<MaintenanceSchedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MaintenanceSchedule | null>(
    null,
  );

  function openCreate() {
    setFormSchedule(null);
    setFormOpen(true);
  }
  function openEdit(schedule: MaintenanceSchedule) {
    setFormSchedule(schedule);
    setFormOpen(true);
  }
  function handleDelete() {
    if (!deleteTarget) return;
    deleteSchedule.mutate(deleteTarget.id, {
      onSuccess: () => {
        retroToast.success(t`DONE · Schedule deleted.`);
        setDeleteTarget(null);
      },
    });
  }

  return (
    <>
      <RetroDialog
        open={invId !== null}
        onClose={onClose}
        title={itemName ? t`MAINTENANCE — ${itemName}` : t`MAINTENANCE`}
        titlebarVariant="blue"
      >
        {/* (1) ⊕ ADD SCHEDULE — mint primary, right-aligned. */}
        <div className="flex justify-end">
          <BevelButton variant="mint" onClick={openCreate}>
            <Trans>⊕ ADD SCHEDULE</Trans>
          </BevelButton>
        </div>

        {/* (2) schedule list / loading / error / empty. */}
        {isLoading ? (
          <p className="bg-bg-panel-2 p-sp-4 font-mono text-12 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        ) : isError ? (
          <p className="bg-bg-panel-2 p-sp-4 text-14 text-danger">
            <Trans>Couldn't load maintenance. Try again.</Trans>
          </p>
        ) : items.length === 0 ? (
          <div className="bg-bg-panel-2 p-sp-3">
            <RetroEmptyState
              eyebrow={<Trans>Maintenance</Trans>}
              glyph="◇"
              heading={<Trans>NO SCHEDULES</Trans>}
              body={
                <Trans>
                  No recurring maintenance set up for this entry yet. Add a
                  schedule to get reminders.
                </Trans>
              }
              action={{
                label: <Trans>⊕ ADD SCHEDULE</Trans>,
                onClick: openCreate,
              }}
            />
          </div>
        ) : (
          <ul className="bg-bg-panel-2">
            {items.map((schedule) => (
              <li
                key={schedule.id}
                className="flex flex-col gap-sp-1 border-b border-table-rule px-sp-3 py-sp-2"
              >
                <div className="flex items-baseline justify-between gap-sp-2">
                  <span className="text-14 font-semibold text-fg-ink">
                    {schedule.title}
                  </span>
                  <span className="font-mono text-12 tabular-nums text-fg-muted">
                    {t`every ${schedule.interval_days}d`}
                  </span>
                </div>

                {/* Line 2: NEUTRAL mono next_due — NO overdue cue here (#3). */}
                <div className="flex flex-wrap items-baseline gap-sp-2 font-mono text-12 tabular-nums text-fg-muted">
                  <span>
                    <Trans>Next due</Trans> {formatDate(schedule.next_due)}
                  </span>
                  <span>·</span>
                  <span>
                    <Trans>Last done</Trans>{" "}
                    {schedule.last_completed_at
                      ? formatDate(schedule.last_completed_at)
                      : t`never`}
                  </span>
                </div>

                {/* Actions — COMPLETE / EDIT / DELETE. */}
                <div className="flex flex-wrap justify-end gap-sp-1">
                  <BevelButton
                    className="!px-[8px] !py-[2px] !text-11"
                    onClick={() => setCompleteTarget(schedule)}
                  >
                    <Trans>COMPLETE</Trans>
                  </BevelButton>
                  <BevelButton
                    className="!px-[8px] !py-[2px] !text-11"
                    onClick={() => openEdit(schedule)}
                  >
                    <Trans>EDIT</Trans>
                  </BevelButton>
                  <BevelButton
                    className="!px-[8px] !py-[2px] !text-11"
                    onClick={() => setDeleteTarget(schedule)}
                  >
                    <Trans>DELETE</Trans>
                  </BevelButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </RetroDialog>

      {/* Nested create/edit form (keyed so a fresh form mounts per target). */}
      {invId !== null && formOpen && (
        <MaintenanceForm
          key={formSchedule?.id ?? "create"}
          open={formOpen}
          invId={invId}
          schedule={formSchedule}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Nested complete confirm. */}
      {completeTarget && (
        <CompleteMaintenanceDialog
          key={completeTarget.id}
          open
          schedule={completeTarget}
          onClose={() => setCompleteTarget(null)}
        />
      )}

      {/* Delete confirm (pink — true destructive). */}
      {deleteTarget && (
        <RetroConfirmDialog
          open
          title={<Trans>DELETE SCHEDULE?</Trans>}
          confirmLabel={<Trans>DELETE</Trans>}
          confirmDisabled={deleteSchedule.isPending}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          onClose={() => setDeleteTarget(null)}
        >
          <Trans>This maintenance schedule will be permanently removed.</Trans>
        </RetroConfirmDialog>
      )}
    </>
  );
}
