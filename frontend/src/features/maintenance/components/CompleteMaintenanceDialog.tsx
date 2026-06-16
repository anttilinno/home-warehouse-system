import { Trans, useLingui } from "@lingui/react/macro";
import { RetroConfirmDialog, retroToast } from "@/components/retro";
import { useMaintenanceMutations } from "../hooks/useMaintenanceMutations";
import type { MaintenanceSchedule } from "@/lib/types";

// Phase 10b Plan 04 — the COMPLETE MAINTENANCE confirm (UI-SPEC §4). A BLUE
// RetroConfirmDialog (completion is a POSITIVE action, NOT destructive — R8,
// mirrors the loans-return resolution). One-tap: NO notes input (R16) — the UI
// just calls POST /maintenance/{id}/complete and the server advances next_due
// (max(today, next_due + interval)) + writes a repair-log row + sets
// last_completed_at. The success toast names the server-returned NEW next_due
// (override #3 — the date comes from the server, never client-computed).

export interface CompleteMaintenanceDialogProps {
  open: boolean;
  onClose: () => void;
  schedule: MaintenanceSchedule;
  /** Called after a successful complete (so the host can clear/close state). */
  onCompleted?: () => void;
}

export function CompleteMaintenanceDialog({
  open,
  onClose,
  schedule,
  onCompleted,
}: Readonly<CompleteMaintenanceDialogProps>) {
  const { t } = useLingui();
  const { completeSchedule } = useMaintenanceMutations();

  function handleConfirm() {
    completeSchedule.mutate(schedule.id, {
      onSuccess: (updated) => {
        // Name the SERVER-returned next_due — the row visibly jumps / leaves
        // the due list, so the toast explains why.
        const nextDue = (updated?.next_due ?? "").slice(0, 10);
        retroToast.success(t`DONE · Marked done — next due ${nextDue}.`);
        onClose();
        onCompleted?.();
      },
    });
  }

  return (
    <RetroConfirmDialog
      open={open}
      title={<Trans>COMPLETE MAINTENANCE?</Trans>}
      titlebarVariant="blue"
      confirmVariant="primary"
      confirmLabel={<Trans>COMPLETE</Trans>}
      cancelLabel={<Trans>CANCEL</Trans>}
      confirmDisabled={completeSchedule.isPending}
      onConfirm={handleConfirm}
      onCancel={onClose}
      onClose={onClose}
    >
      <Trans>
        Mark "{schedule.title}" done? This advances the next due date by{" "}
        {schedule.interval_days} days.
      </Trans>
    </RetroConfirmDialog>
  );
}
