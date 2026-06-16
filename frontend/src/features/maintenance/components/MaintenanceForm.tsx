import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  RetroDialog,
  RetroConfirmDialog,
  BevelButton,
  RetroInput,
  RetroTextarea,
  retroToast,
} from "@/components/retro";
import {
  maintenanceFormSchema,
  type MaintenanceFormInput,
  type MaintenanceFormValues,
} from "../schema";
import { useMaintenanceMutations } from "../hooks/useMaintenanceMutations";
import type { MaintenanceSchedule } from "@/lib/types";

// Phase 10b Plan 04 — the schedule create/edit form (UI-SPEC §4). A BLUE
// RetroDialog NESTED over the Maintenance drawer (NOT a route): the schedule is
// scoped to the inventory entry already open in the drawer, so inventory_id is
// implicit on create and NEVER a form field. RHF + zod via maintenanceFormSchema
// (Title required / Interval days >= 1 / Next due required / Notes). A dirty
// close opens the butter DISCARD CHANGES? confirm (the shared idiom).

export interface MaintenanceFormProps {
  open: boolean;
  onClose: () => void;
  /** The inventory entry this schedule belongs to (implicit inventory_id). */
  invId: string;
  /** When set, the form edits this schedule; otherwise it creates. */
  schedule?: MaintenanceSchedule | null;
}

// Slice an RFC3339/date value to the <input type="date"> YYYY-MM-DD value.
function toDateInput(value?: string): string {
  return value ? value.slice(0, 10) : "";
}

// The <input type="date"> yields YYYY-MM-DD, but POST/PATCH /maintenance
// require an RFC 3339 date-time (the read side returns date-only — asymmetric
// contract). Serialize the day to midnight UTC before sending.
function toRfc3339Date(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
}

function scheduleToDefaults(
  schedule?: MaintenanceSchedule | null,
): MaintenanceFormInput {
  return {
    title: schedule?.title ?? "",
    interval_days: schedule?.interval_days ?? 30,
    next_due: toDateInput(schedule?.next_due),
    notes: schedule?.notes ?? "",
  };
}

export function MaintenanceForm({
  open,
  onClose,
  invId,
  schedule,
}: Readonly<MaintenanceFormProps>) {
  const { t } = useLingui();
  const isEdit = Boolean(schedule);
  const { createSchedule, updateSchedule } = useMaintenanceMutations();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isDirty, isSubmitting },
  } = useForm<MaintenanceFormInput, unknown, MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: scheduleToDefaults(schedule),
  });

  async function onSubmit(values: MaintenanceFormValues) {
    try {
      if (isEdit && schedule) {
        // PATCH dirty fields only.
        const body: Record<string, unknown> = {};
        if (dirtyFields.title) body.title = values.title;
        if (dirtyFields.interval_days)
          body.interval_days = values.interval_days;
        if (dirtyFields.next_due)
          body.next_due = toRfc3339Date(values.next_due);
        if (dirtyFields.notes) body.notes = values.notes || undefined;
        await updateSchedule.mutateAsync({ id: schedule.id, body });
        retroToast.success(t`DONE · Schedule updated.`);
      } else {
        await createSchedule.mutateAsync({
          inventory_id: invId,
          title: values.title,
          interval_days: values.interval_days,
          next_due: toRfc3339Date(values.next_due),
          notes: values.notes || undefined,
        });
        retroToast.success(t`DONE · Schedule saved.`);
      }
      onClose();
    } catch {
      setError("root", { message: t`Couldn't save this schedule.` });
    }
  }

  function attemptClose() {
    if (isDirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  }

  return (
    <>
      <RetroDialog
        open={open}
        onClose={attemptClose}
        title={
          isEdit ? <Trans>EDIT SCHEDULE</Trans> : <Trans>ADD SCHEDULE</Trans>
        }
        titlebarVariant="blue"
        footer={
          <>
            <BevelButton variant="neutral" onClick={attemptClose}>
              <Trans>CANCEL</Trans>
            </BevelButton>
            <BevelButton
              variant="primary"
              type="submit"
              form="maintenance-form"
              disabled={isSubmitting}
            >
              {isEdit ? (
                <Trans>SAVE CHANGES</Trans>
              ) : (
                <Trans>SAVE SCHEDULE</Trans>
              )}
            </BevelButton>
          </>
        }
      >
        <form
          id="maintenance-form"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-sp-4"
        >
          {errors.root?.message && (
            <div
              role="alert"
              className="border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
            >
              <span aria-hidden="true">✕ </span>
              {errors.root.message}
            </div>
          )}

          <RetroInput
            label={<Trans>Title</Trans>}
            type="text"
            required
            aria-required="true"
            error={errors.title?.message}
            {...register("title")}
          />

          <RetroInput
            label={<Trans>Interval (days)</Trans>}
            type="number"
            min={1}
            mono
            required
            aria-required="true"
            error={errors.interval_days?.message}
            {...register("interval_days", { valueAsNumber: true })}
          />
          <p className="-mt-sp-3 text-12 font-body text-fg-muted">
            <Trans>How often this repeats, in days.</Trans>
          </p>

          <RetroInput
            label={<Trans>Next due</Trans>}
            type="date"
            mono
            required
            aria-required="true"
            error={errors.next_due?.message}
            {...register("next_due")}
          />

          <RetroTextarea
            label={<Trans>Notes</Trans>}
            className="min-h-[72px]"
            error={errors.notes?.message}
            {...register("notes")}
          />
        </form>
      </RetroDialog>

      {/* Dirty-close discard guard (butter, non-destructive decision). */}
      <RetroConfirmDialog
        open={confirmDiscard}
        title={<Trans>DISCARD CHANGES?</Trans>}
        titlebarVariant="butter"
        confirmVariant="neutral"
        confirmLabel={<Trans>DISCARD</Trans>}
        cancelLabel={<Trans>KEEP EDITING</Trans>}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        onCancel={() => setConfirmDiscard(false)}
        onClose={() => setConfirmDiscard(false)}
      >
        <Trans>Your edits will be lost.</Trans>
      </RetroConfirmDialog>
    </>
  );
}
