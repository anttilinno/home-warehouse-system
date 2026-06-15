import { useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import {
  Window,
  BevelButton,
  StatusPill,
  RetroEmptyState,
} from "@/components/retro";
import type { Loan } from "@/lib/types";
import { useDateFormat } from "@/lib/format";
import { loansApi, type PartitionedLoans } from "@/lib/api/loans";
import { loanStatus } from "@/features/loans/loanStatus";
import { ReturnLoanDialog } from "@/features/loans/components/ReturnLoanDialog";
import { ExtendLoanDialog } from "@/features/loans/components/ExtendLoanDialog";

// Phase 8 Plan 04 — the item-detail loan surfaces, made REAL (LOAN-05). The
// shared query (key ["loans", wsId, "by-item", itemId]) returns ALL loans
// partitioned client-side on is_active (07-RESEARCH OQ2). The active panel now
// drives the live lifecycle: ⊕ LOAN THIS ITEM when available, RETURN + EXTEND
// (Plan-04 dialogs) when on loan, and a server-authoritative overdue chip
// (loan.is_overdue — override 2, NEVER client date math). History pills use the
// three-way loanStatus (Active / Overdue / Returned).

/** The shared per-item loans query (consumed by both the active panel + history). */
export function useItemLoans(
  wsId: string,
  itemId: string,
): ReturnType<typeof useQuery<PartitionedLoans>> {
  return useQuery({
    queryKey: ["loans", wsId, "by-item", itemId],
    queryFn: () => loansApi.byItem(wsId, itemId),
    enabled: Boolean(wsId) && Boolean(itemId),
  });
}

export interface ActiveLoanPanelProps {
  /** The active (is_active===true) loans for this item; first one drives the panel. */
  active: Loan[];
  /** The item these loans target — powers the ⊕ CTA + dialogs. */
  itemId: string;
}

/**
 * The side-rail active-loan panel (UI-SPEC §2). Mint `● Available` + a ⊕ LOAN
 * THIS ITEM CTA when free; pink `● On loan to {borrower}` + due date + live
 * RETURN/EXTEND when on loan; a danger overdue chip + line (server is_overdue)
 * when overdue.
 */
export function ActiveLoanPanel({ active, itemId }: ActiveLoanPanelProps) {
  const navigate = useNavigate();
  const [openDialog, setOpenDialog] = useState<"return" | "extend" | null>(
    null,
  );
  // I18N-03: due date honors the user's date_format preference.
  const formatDate = useDateFormat();
  const loan = active[0];

  if (!loan) {
    return (
      <Window title={<Trans>LOAN</Trans>} titlebarVariant="mint">
        <div className="flex flex-col gap-sp-3">
          <p className="text-14 font-semibold text-accent-mint-deep">
            <span aria-hidden="true">● </span>
            <Trans>Available</Trans>
          </p>
          <BevelButton
            type="button"
            onClick={() => navigate(`/loans/new?itemId=${itemId}`)}
          >
            <Trans>⊕ LOAN THIS ITEM</Trans>
          </BevelButton>
        </div>
      </Window>
    );
  }

  return (
    <Window title={<Trans>LOAN</Trans>} titlebarVariant="pink">
      <div className="flex flex-col gap-sp-3">
        <p className="text-14 font-semibold text-accent-pink-deep">
          <span aria-hidden="true">● </span>
          <Trans>On loan to {loan.borrower.name}</Trans>
        </p>
        {loan.due_date && (
          <p className="font-mono text-12 tabular-nums text-fg-muted">
            <Trans>Due {formatDate(loan.due_date)}</Trans>
          </p>
        )}
        {/* Overdue is SERVER-authoritative (loan.is_overdue) — never client date math. */}
        {loan.is_overdue && (
          <div className="flex flex-col gap-sp-1">
            <StatusPill variant="danger">
              <Trans>⚠ Overdue</Trans>
            </StatusPill>
            <p className="text-12 text-danger">
              <Trans>This loan is overdue.</Trans>
            </p>
          </div>
        )}
        <div className="flex flex-col gap-sp-1">
          <BevelButton type="button" onClick={() => setOpenDialog("return")}>
            <Trans>RETURN</Trans>
          </BevelButton>
          <BevelButton type="button" onClick={() => setOpenDialog("extend")}>
            <Trans>EXTEND</Trans>
          </BevelButton>
        </div>
      </div>

      <ReturnLoanDialog
        open={openDialog === "return"}
        onClose={() => setOpenDialog(null)}
        loan={loan}
      />
      <ExtendLoanDialog
        open={openDialog === "extend"}
        onClose={() => setOpenDialog(null)}
        loan={loan}
      />
    </Window>
  );
}

export interface LoanHistoryListProps {
  /** The non-active (returned / still-out) loans for this item. */
  history: Loan[];
}

/**
 * The HISTORY-tab loan list (UI-SPEC §2). Each entry is a panel-2 row: borrower ·
 * checkout date · return date (or `— still out`) · status pill. Empty → the
 * NO LOAN HISTORY empty state.
 */
export function LoanHistoryList({ history }: LoanHistoryListProps) {
  // I18N-03: history dates honor the user's date_format preference.
  const formatDate = useDateFormat();
  if (history.length === 0) {
    return (
      <RetroEmptyState
        eyebrow={<Trans>Loans</Trans>}
        heading={<Trans>NO LOAN HISTORY</Trans>}
        body={<Trans>This item has never been loaned out.</Trans>}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-sp-2">
      {history.map((loan) => {
        // Three-way status (Active / Overdue / Returned) — Plan 01 loanStatus.
        const status = loanStatus(loan);
        return (
          <li
            key={loan.id}
            className="flex flex-wrap items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2"
          >
            <span className="text-14 font-semibold text-fg-ink">
              {loan.borrower.name}
            </span>
            <span className="flex-1" />
            <span className="font-mono text-12 tabular-nums text-fg-muted">
              {formatDate(loan.loaned_at)}
              {" → "}
              {loan.returned_at ? (
                formatDate(loan.returned_at)
              ) : (
                <Trans>— still out</Trans>
              )}
            </span>
            <StatusPill variant={status.variant}>{status.label}</StatusPill>
          </li>
        );
      })}
    </ul>
  );
}

export interface LoanPanelsProps {
  wsId: string;
  itemId: string;
}

/**
 * Convenience wrapper that fetches the partitioned loans and renders the active
 * panel — used by the detail side rail. The HISTORY tab reads the same query via
 * {@link useItemLoans} and renders {@link LoanHistoryList} directly.
 */
export function LoanPanels({ wsId, itemId }: LoanPanelsProps) {
  const { data } = useItemLoans(wsId, itemId);
  const active = useMemo(() => data?.active ?? [], [data]);
  return <ActiveLoanPanel active={active} itemId={itemId} />;
}
