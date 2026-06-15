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
  RetroCheckbox,
} from "@/components/retro";
import {
  repairFormSchema,
  type RepairFormInput,
  type RepairFormValues,
} from "../schema";
import { useRepairMutations } from "../hooks/useRepairMutations";
import type { Repair } from "@/lib/types";

// Phase 10b Plan 02 — the repair create/edit form (UI-SPEC §2). A BLUE
// RetroDialog NESTED over the Repairs drawer (NOT a route — OQ1): the repair is
// scoped to the inventory entry already open in the drawer, so inventory_id is
// implicit and NEVER a form field. RHF + zod via repairFormSchema; the cost field
// is a major-unit string that the schema transforms to integer cents (a float
// NEVER reaches the API — T-10b-01). Create → repairsApi.create; edit → PATCH of
// dirty fields only (NO status — lifecycle is start/complete). A dirty close opens
// the butter DISCARD CHANGES? confirm (the InventoryFormPage idiom).

export interface RepairFormProps {
  open: boolean;
  onClose: () => void;
  /** The inventory entry this repair belongs to (implicit inventory_id). */
  invId: string;
  /** When set, the form edits this repair; otherwise it creates. */
  repair?: Repair | null;
}

// Slice an RFC3339 timestamp to the <input type="date"> YYYY-MM-DD value.
function toDateInput(rfc?: string): string {
  return rfc ? rfc.slice(0, 10) : "";
}

// The <input type="date"> yields YYYY-MM-DD, but the repair endpoints expect an
// RFC 3339 date-time (the read side returns date-only — asymmetric contract, same
// as maintenance). Serialize a bare day to midnight UTC before sending; pass
// through anything already containing a time component or empty.
function toRfc3339Date(value?: string): string | undefined {
  if (!value) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
}

// Cents → major-unit string for the edit-mode cost field reset.
function centsToMajor(cents?: number): string {
  return typeof cents === "number" ? String(cents / 100) : "";
}

function repairToDefaults(repair?: Repair | null): RepairFormInput {
  return {
    description: repair?.description ?? "",
    repair_date: toDateInput(repair?.repair_date),
    cost: centsToMajor(repair?.cost),
    currency_code: repair?.currency_code ?? "",
    service_provider: repair?.service_provider ?? "",
    is_warranty_claim: repair?.is_warranty_claim ?? false,
    reminder_date: toDateInput(repair?.reminder_date),
  };
}

export function RepairForm({ open, onClose, invId, repair }: RepairFormProps) {
  const { t } = useLingui();
  const isEdit = Boolean(repair);
  const { createRepair, updateRepair } = useRepairMutations();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isDirty, isSubmitting },
  } = useForm<RepairFormInput, unknown, RepairFormValues>({
    resolver: zodResolver(repairFormSchema),
    defaultValues: repairToDefaults(repair),
  });

  async function onSubmit(values: RepairFormValues) {
    try {
      if (isEdit && repair) {
        // PATCH dirty editable fields only — NO status (lifecycle is start/complete).
        const body: Record<string, unknown> = {};
        if (dirtyFields.description) body.description = values.description;
        if (dirtyFields.repair_date)
          body.repair_date = toRfc3339Date(values.repair_date);
        if (dirtyFields.cost) body.cost = values.cost;
        if (dirtyFields.currency_code)
          body.currency_code = values.currency_code || undefined;
        if (dirtyFields.service_provider)
          body.service_provider = values.service_provider || undefined;
        await updateRepair.mutateAsync({ id: repair.id, body });
      } else {
        await createRepair.mutateAsync({
          inventory_id: invId,
          description: values.description,
          repair_date: toRfc3339Date(values.repair_date),
          cost: values.cost,
          currency_code: values.currency_code || undefined,
          service_provider: values.service_provider || undefined,
          is_warranty_claim: values.is_warranty_claim,
          reminder_date: toRfc3339Date(values.reminder_date),
        });
      }
      onClose();
    } catch {
      setError("root", { message: t`Couldn't save this repair.` });
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
        title={isEdit ? <Trans>EDIT REPAIR</Trans> : <Trans>ADD REPAIR</Trans>}
        titlebarVariant="blue"
        footer={
          <>
            <BevelButton variant="neutral" onClick={attemptClose}>
              <Trans>CANCEL</Trans>
            </BevelButton>
            <BevelButton
              variant="primary"
              type="submit"
              form="repair-form"
              disabled={isSubmitting}
            >
              {isEdit ? (
                <Trans>SAVE CHANGES</Trans>
              ) : (
                <Trans>SAVE REPAIR</Trans>
              )}
            </BevelButton>
          </>
        }
      >
        <form
          id="repair-form"
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

          <RetroTextarea
            label={<Trans>Description</Trans>}
            required
            aria-required="true"
            className="min-h-[88px]"
            error={errors.description?.message}
            {...register("description")}
          />

          <RetroInput
            label={<Trans>Repair date</Trans>}
            type="date"
            mono
            error={errors.repair_date?.message}
            {...register("repair_date")}
          />

          <RetroInput
            label={<Trans>Cost</Trans>}
            inputMode="decimal"
            mono
            error={errors.cost?.message}
            {...register("cost")}
          />
          <p className="-mt-sp-3 text-12 font-body text-fg-muted">
            <Trans>Amount in your workspace currency.</Trans>
          </p>

          <RetroInput
            label={<Trans>Service provider</Trans>}
            type="text"
            error={errors.service_provider?.message}
            {...register("service_provider")}
          />

          <RetroCheckbox
            label={<Trans>Covered under warranty</Trans>}
            {...register("is_warranty_claim")}
          />

          <RetroInput
            label={<Trans>Reminder date</Trans>}
            type="date"
            mono
            error={errors.reminder_date?.message}
            {...register("reminder_date")}
          />
          <p className="-mt-sp-3 text-12 font-body text-fg-muted">
            <Trans>Optional — a follow-up maintenance reminder.</Trans>
          </p>
        </form>
      </RetroDialog>

      {/* Dirty-close discard guard (butter, non-destructive decision). */}
      <RetroConfirmDialog
        open={confirmDiscard}
        title={<Trans>DISCARD CHANGES?</Trans>}
        titlebarVariant="butter"
        confirmVariant="neutral"
        confirmLabel={<Trans>Discard</Trans>}
        cancelLabel={<Trans>Keep editing</Trans>}
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
