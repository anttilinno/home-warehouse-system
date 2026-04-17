import { useLingui } from "@lingui/react/macro";
import { Pencil, Undo2 } from "../icons";
import type { Loan } from "@/lib/api/loans";

interface LoanRowActionsProps {
  loan: Loan;
  onEdit: (loan: Loan) => void;
  onMarkReturned: (loan: Loan) => void;
  disabled?: boolean;
}

/**
 * LoanRowActions — MARK RETURNED + EDIT buttons for an ACTIVE / OVERDUE
 * loan row. Icon-only on mobile (<1024px), icon+label ≥1024px, both with
 * 44×44 touch targets per UI-SPEC.
 *
 * aria-label interpolates item + borrower name for screen reader context
 * ("Mark loan of Cordless Drill to Alice as returned").
 */
export function LoanRowActions({
  loan,
  onEdit,
  onMarkReturned,
  disabled,
}: LoanRowActionsProps) {
  const { t } = useLingui();
  const itemName = loan.item.name;
  const borrowerName = loan.borrower.name;
  const btn =
    "min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] inline-flex items-center justify-center gap-xs px-sm border-retro-thick border-retro-ink bg-retro-cream text-[12px] font-bold uppercase cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <div className="flex items-center gap-xs justify-end">
      <button
        type="button"
        aria-label={t`Mark loan of ${itemName} to ${borrowerName} as returned`}
        onClick={() => onMarkReturned(loan)}
        disabled={disabled}
        className={btn}
      >
        <Undo2 size={14} />
        <span className="hidden lg:inline">{t`MARK RETURNED`}</span>
      </button>
      <button
        type="button"
        aria-label={t`Edit loan of ${itemName} to ${borrowerName}`}
        onClick={() => onEdit(loan)}
        disabled={disabled}
        className={btn}
      >
        <Pencil size={14} />
        <span className="hidden lg:inline">{t`EDIT`}</span>
      </button>
    </div>
  );
}
