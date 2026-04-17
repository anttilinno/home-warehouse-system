import { useRef } from "react";
import { Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import {
  RetroPanel,
  RetroEmptyState,
  RetroButton,
  HazardStripe,
} from "@/components/retro";
import { AlertTriangle, Undo2 } from "../icons";
import { useLoansForItem } from "../hooks/useLoansForItem";
import {
  LoanReturnFlow,
  type LoanReturnFlowHandle,
} from "../actions/LoanReturnFlow";

/**
 * ItemActiveLoanPanel — /items/:id ACTIVE LOAN card.
 *
 * Wraps useLoansForItem + LoanReturnFlow inline dialog so the item detail
 * page doesn't need to know about the return flow machinery.
 */
interface ItemActiveLoanPanelProps {
  itemId: string;
}

export function ItemActiveLoanPanel({ itemId }: ItemActiveLoanPanelProps) {
  const { t } = useLingui();
  const query = useLoansForItem(itemId);
  const returnFlowRef = useRef<LoanReturnFlowHandle>(null);

  if (query.isPending) {
    return (
      <RetroPanel>
        <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
      </RetroPanel>
    );
  }

  if (query.isError) {
    return (
      <RetroPanel>
        <HazardStripe className="mb-md" />
        <h3 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
          {t`COULD NOT LOAD LOANS`}
        </h3>
        <p className="text-retro-ink mb-md">
          {t`Check your connection and try again.`}
        </p>
        <RetroButton variant="primary" onClick={() => query.refetch()}>
          {t`RETRY`}
        </RetroButton>
      </RetroPanel>
    );
  }

  const loan = query.activeLoan;
  if (!loan) {
    return (
      <RetroEmptyState
        title={t`NO ACTIVE LOAN`}
        body={t`This item isn't currently out on loan.`}
      />
    );
  }

  const notes = loan.notes ?? "";
  const truncatedNotes =
    notes.length > 200 ? `${notes.slice(0, 200)}…` : notes;

  return (
    <>
      <RetroPanel>
        <div className="flex items-start justify-between gap-md flex-wrap">
          <div className="flex flex-col gap-xs min-w-0 flex-1">
            <div className="flex items-center gap-md flex-wrap">
              <Link
                to={`/borrowers/${loan.borrower_id}`}
                className="font-sans text-retro-ink underline"
              >
                {loan.borrower.name}
              </Link>
              <span className="font-mono text-retro-ink">×{loan.quantity}</span>
            </div>
            <div className="flex items-center gap-md flex-wrap text-[14px]">
              <span className="font-sans font-semibold uppercase text-retro-charcoal/70">
                {t`LOANED`}
              </span>
              <span className="font-mono text-retro-ink">
                {loan.loaned_at.slice(0, 10)}
              </span>
              <span className="font-sans font-semibold uppercase text-retro-charcoal/70">
                {t`DUE`}
              </span>
              {loan.due_date ? (
                loan.is_overdue ? (
                  <span className="inline-flex items-center gap-xs font-mono text-retro-red">
                    <AlertTriangle size={16} />
                    {loan.due_date.slice(0, 10)}
                  </span>
                ) : (
                  <span className="font-mono text-retro-ink">
                    {loan.due_date.slice(0, 10)}
                  </span>
                )
              ) : (
                <span className="font-mono text-retro-gray">—</span>
              )}
            </div>
            {loan.notes && (
              <p className="font-sans text-retro-ink mt-sm" title={loan.notes}>
                {truncatedNotes}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label={t`Mark loan of ${loan.item.name} to ${loan.borrower.name} as returned`}
            onClick={() => returnFlowRef.current?.open(loan)}
            className="min-h-[44px] inline-flex items-center gap-xs px-md border-retro-thick border-retro-ink bg-retro-cream text-[14px] font-bold uppercase cursor-pointer"
          >
            <Undo2 size={14} />
            {t`MARK RETURNED`}
          </button>
        </div>
      </RetroPanel>
      <LoanReturnFlow ref={returnFlowRef} />
    </>
  );
}
