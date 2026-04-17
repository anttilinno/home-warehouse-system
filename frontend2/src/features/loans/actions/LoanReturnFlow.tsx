import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroConfirmDialog,
  type RetroConfirmDialogHandle,
} from "@/components/retro";
import { useReturnLoan } from "../hooks/useLoanMutations";
import type { Loan } from "@/lib/api/loans";

export interface LoanReturnFlowHandle {
  open: (loan: Loan) => void;
  close: () => void;
}

/**
 * LoanReturnFlow — single-step amber confirm dialog for MARK RETURNED.
 *
 * UI-SPEC:
 *   - RetroConfirmDialog with variant="soft" (amber primary, no hazard stripe)
 *   - Title: CONFIRM RETURN
 *   - Body: "Mark '<item>' returned by '<borrower>'? The loan will move to history."
 *   - Escape: ← BACK; Destructive (actually amber here): RETURN LOAN
 *
 * The parent stores the target via setState-style ref exposure: `open(loan)`
 * stashes the loan in internal state; the dialog's onConfirm invokes
 * useReturnLoan with the foreign keys required for UI-SPEC invalidation.
 *
 * Confirm failure keeps the dialog open — the mutation hook's onError fires
 * the toast. RetroConfirmDialog's internal handleConfirm awaits the provided
 * onConfirm before closing, so we must NOT propagate throws (already handled
 * inside mutateAsync + try/catch).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
const LoanReturnFlow = forwardRef<LoanReturnFlowHandle, {}>(
  function LoanReturnFlow(_props, ref) {
    const { t } = useLingui();
    const dialogRef = useRef<RetroConfirmDialogHandle>(null);
    const [loan, setLoan] = useState<Loan | null>(null);
    const returnMutation = useReturnLoan();

    useImperativeHandle(ref, () => ({
      open: (l) => {
        setLoan(l);
        dialogRef.current?.open();
      },
      close: () => dialogRef.current?.close(),
    }));

    const handleConfirm = useCallback(async () => {
      if (!loan) return;
      try {
        await returnMutation.mutateAsync({
          id: loan.id,
          itemId: loan.item.id,
          borrowerId: loan.borrower_id,
        });
        // Success: RetroConfirmDialog closes after the awaited promise resolves.
      } catch {
        // Mutation hook toasts; RetroConfirmDialog will still call .close()
        // after this returns. Reopen the dialog so the user can retry — the
        // loan state is preserved. The 0ms timer lets the close() settle
        // before we reopen, avoiding a same-microtask showModal() while the
        // close is in-flight.
        setTimeout(() => dialogRef.current?.open(), 0);
      }
    }, [loan, returnMutation]);

    const itemName = loan?.item.name ?? "";
    const borrowerName = loan?.borrower.name ?? "";

    return (
      <RetroConfirmDialog
        ref={dialogRef}
        variant="soft"
        title={t`CONFIRM RETURN`}
        body={t`Mark ${itemName} returned by ${borrowerName}? The loan will move to history.`}
        escapeLabel={t`← BACK`}
        destructiveLabel={t`RETURN LOAN`}
        onConfirm={handleConfirm}
      />
    );
  },
);

LoanReturnFlow.displayName = "LoanReturnFlow";

export { LoanReturnFlow };
