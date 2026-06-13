import { Trans, useLingui } from "@lingui/react/macro";
import { RetroConfirmDialog, retroToast } from "@/components/retro";
import type { Loan } from "@/lib/types";
import { useLoanMutations } from "../hooks/useLoanMutations";

// Phase 8 Plan 04 — LOAN-03 return confirm (UI-SPEC R9). BLUE titlebar: return
// is a reversible completion, NOT a destructive action (override — not pink).
// Optimistic mutation moves the loan to History; revert + toast on error.

export interface ReturnLoanDialogProps {
  open: boolean;
  onClose: () => void;
  loan: Loan;
}

export function ReturnLoanDialog({ open, onClose, loan }: ReturnLoanDialogProps) {
  const { t } = useLingui();
  const { returnLoan } = useLoanMutations();

  function handleConfirm() {
    returnLoan.mutate(loan.id, {
      onSuccess: () => {
        retroToast.success(t`Returned — moved to History.`);
        onClose();
      },
    });
  }

  return (
    <RetroConfirmDialog
      open={open}
      title={<Trans>RETURN LOAN?</Trans>}
      titlebarVariant="blue"
      confirmVariant="primary"
      confirmLabel={<Trans>Return</Trans>}
      confirmDisabled={returnLoan.isPending}
      onConfirm={handleConfirm}
      onCancel={onClose}
      onClose={onClose}
    >
      <Trans>
        Mark "{loan.item.name}" returned by {loan.borrower.name}?
      </Trans>
    </RetroConfirmDialog>
  );
}
