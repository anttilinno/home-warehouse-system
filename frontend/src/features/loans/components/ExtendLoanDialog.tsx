import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  BevelButton,
  RetroDialog,
  RetroInput,
  retroToast,
} from "@/components/retro";
import type { Loan } from "@/lib/types";
import { useLoanMutations } from "../hooks/useLoanMutations";

// Phase 8 Plan 04 — LOAN-04 extend (UI-SPEC R10). BLUE titlebar (utility task,
// mirrors MoveDialog). A required New due date; the wire body is
// `{ new_due_date }` (loansApi.extend / Plan 01). Optimistic + revert on error.

export interface ExtendLoanDialogProps {
  open: boolean;
  onClose: () => void;
  loan: Loan;
}

/** YYYY-MM-DD for the date input — from an ISO timestamp, or N days from base. */
function toDateInput(iso: string | undefined, plusDays = 0): string {
  const base = iso ? new Date(iso) : new Date();
  if (Number.isNaN(base.getTime()))
    return new Date().toISOString().slice(0, 10);
  base.setUTCDate(base.getUTCDate() + plusDays);
  return base.toISOString().slice(0, 10);
}

export function ExtendLoanDialog({
  open,
  onClose,
  loan,
}: Readonly<ExtendLoanDialogProps>) {
  const { t } = useLingui();
  const { extendLoan } = useLoanMutations();

  // Default: current due + 7d, or (no due date) today + 7d.
  const [dueDate, setDueDate] = useState(() => toDateInput(loan.due_date, 7));

  const extending = extendLoan.isPending;
  const canExtend = dueDate.length > 0 && !extending;

  function handleConfirm() {
    // Date input is a local YYYY-MM-DD; send as a UTC RFC3339 midpoint.
    const new_due_date = new Date(`${dueDate}T00:00:00Z`).toISOString();
    extendLoan.mutate(
      { id: loan.id, new_due_date },
      {
        onSuccess: () => {
          retroToast.success(t`Due date extended.`);
          onClose();
        },
      },
    );
  }

  const currentDue = loan.due_date
    ? new Date(loan.due_date).toISOString().slice(0, 10)
    : t`no due date`;

  return (
    <RetroDialog
      open={open}
      onClose={onClose}
      title={<Trans>EXTEND LOAN</Trans>}
      titlebarVariant="blue"
      width="min(420px,92vw)"
      footer={
        <>
          <BevelButton
            type="button"
            variant="neutral"
            onClick={onClose}
            disabled={extending}
          >
            <Trans>Cancel</Trans>
          </BevelButton>
          <BevelButton
            type="button"
            variant="primary"
            disabled={!canExtend}
            onClick={handleConfirm}
          >
            <Trans>Extend</Trans>
          </BevelButton>
        </>
      }
    >
      <p className="text-12 text-fg-muted">
        <Trans>
          {loan.item.name} — currently due {currentDue}.
        </Trans>
      </p>
      <div className="mt-sp-3">
        <RetroInput
          type="date"
          required
          aria-required="true"
          label={<Trans>New due date</Trans>}
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
    </RetroDialog>
  );
}
