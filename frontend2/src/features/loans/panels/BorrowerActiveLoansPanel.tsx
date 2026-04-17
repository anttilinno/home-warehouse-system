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
import { ItemThumbnailCell } from "@/features/items/photos/ItemThumbnailCell";
import { useLoansForBorrower } from "../hooks/useLoansForBorrower";
import {
  LoanReturnFlow,
  type LoanReturnFlowHandle,
} from "../actions/LoanReturnFlow";

/**
 * BorrowerActiveLoansPanel — /borrowers/:id ACTIVE LOANS section.
 *
 * Unlike the item panel (single active loan), a borrower may hold many open
 * loans simultaneously. Renders a stacked row per loan with item thumbnail,
 * item link, qty, loaned/due dates, overdue emphasis, and MARK RETURNED.
 * LoanReturnFlow is mounted once at panel scope and reused for each row.
 */
interface BorrowerActiveLoansPanelProps {
  borrowerId: string;
}

export function BorrowerActiveLoansPanel({
  borrowerId,
}: BorrowerActiveLoansPanelProps) {
  const { t } = useLingui();
  const query = useLoansForBorrower(borrowerId);
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

  const active = query.activeLoans;
  if (active.length === 0) {
    return (
      <RetroEmptyState
        title={t`NO ACTIVE LOANS`}
        body={t`This borrower isn't holding anything right now.`}
      />
    );
  }

  return (
    <>
      <RetroPanel>
        <ul className="flex flex-col divide-y-2 divide-retro-charcoal">
          {active.map((loan) => (
            <li
              key={loan.id}
              className="flex items-center gap-md py-sm flex-wrap"
            >
              <ItemThumbnailCell
                thumbnailUrl={loan.item.primary_photo_thumbnail_url}
                size={24}
              />
              <Link
                to={`/items/${loan.inventory_id}`}
                className="font-sans text-retro-ink underline flex-1 min-w-0"
              >
                {loan.item.name}
              </Link>
              <span className="font-mono text-retro-ink">×{loan.quantity}</span>
              <span className="font-mono text-retro-ink">
                {loan.loaned_at.slice(0, 10)}
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
              <button
                type="button"
                aria-label={t`Mark loan of ${loan.item.name} to ${loan.borrower.name} as returned`}
                onClick={() => returnFlowRef.current?.open(loan)}
                className="min-h-[44px] inline-flex items-center gap-xs px-md border-retro-thick border-retro-ink bg-retro-cream text-[14px] font-bold uppercase cursor-pointer"
              >
                <Undo2 size={14} />
                <span className="hidden lg:inline">{t`MARK RETURNED`}</span>
              </button>
            </li>
          ))}
        </ul>
      </RetroPanel>
      <LoanReturnFlow ref={returnFlowRef} />
    </>
  );
}
