import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroDialog,
  RetroInput,
  RetroTextarea,
  retroToast,
} from "@/components/retro";
import type { Loan } from "@/lib/types";
import { useLoanMutations } from "../hooks/useLoanMutations";

// Phase 8 Plan 04 — LOAN-04 edit (UI-SPEC R11). BLUE titlebar (utility task,
// mirrors MoveDialog). Due date (optional — clearing it removes the due date)
// + Notes. Optimistic via updateLoan ({ due_date?, notes? } / Plan 01) with
// revert on error.

export interface EditLoanDialogProps {
  open: boolean;
  onClose: () => void;
  loan: Loan;
}

/** YYYY-MM-DD for the date input from an ISO timestamp (empty when none). */
function toDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function EditLoanDialog({ open, onClose, loan }: EditLoanDialogProps) {
  const { t } = useLingui();
  const { updateLoan } = useLoanMutations();

  const [dueDate, setDueDate] = useState(() => toDateInput(loan.due_date));
  const [notes, setNotes] = useState(loan.notes ?? "");

  const saving = updateLoan.isPending;

  function handleConfirm() {
    // Empty date input clears the due date (send empty string per Plan 01 body).
    const due_date = dueDate
      ? new Date(`${dueDate}T00:00:00Z`).toISOString()
      : "";
    updateLoan.mutate(
      { id: loan.id, due_date, notes },
      {
        onSuccess: () => {
          retroToast.success(t`Loan saved.`);
          onClose();
        },
      },
    );
  }

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={<Trans>EDIT LOAN</Trans>}
      titlebarVariant="blue"
      width="min(420px,92vw)"
      footer={
        <>
          <BevelButton
            type="button"
            variant="neutral"
            onClick={onClose}
            disabled={saving}
          >
            <Trans>Cancel</Trans>
          </BevelButton>
          <BevelButton
            type="button"
            variant="primary"
            disabled={saving}
            onClick={handleConfirm}
          >
            <Trans>Save</Trans>
          </BevelButton>
        </>
      }
    >
      <p className="text-12 text-fg-muted">
        <Trans>
          {loan.item.name} — loaned to {loan.borrower.name}.
        </Trans>
      </p>
      <div className="mt-sp-3 flex flex-col gap-sp-3">
        <RetroInput
          type="date"
          label={<Trans>Due date</Trans>}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <RetroTextarea
          label={<Trans>Notes</Trans>}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
    </RetroDialog>
  );
}
