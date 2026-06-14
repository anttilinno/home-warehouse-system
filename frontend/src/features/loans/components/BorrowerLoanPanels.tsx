import { useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import { Link } from "react-router";
import {
  Window,
  StatusPill,
  BevelButton,
  RetroEmptyState,
} from "@/components/retro";
import type { Loan } from "@/lib/types";
import { useDateFormat } from "@/lib/format";
import { useBorrowerLoans } from "@/features/loans/hooks/useBorrowerLoans";
import { loanStatus } from "@/features/loans/loanStatus";
import { ReturnLoanDialog } from "@/features/loans/components/ReturnLoanDialog";
import { ExtendLoanDialog } from "@/features/loans/components/ExtendLoanDialog";

// Phase 8 Plan 05 — the borrower-side loan surfaces (LOAN-06), MIRRORING the
// item-detail LoanPanels language (UI-SPEC §7): two Windows. The Active Loans
// panel lists EVERY active loan a borrower holds (pink titlebar when ≥1, mint
// `● Nothing out` when none); each row links to the item, shows a server-flag
// due chip (override 2: ⚠ from loan.is_overdue, NEVER client date math) + the
// three-way loanStatus pill + RETURN/EXTEND reusing the Plan-04 dialogs. The
// Loan History panel reuses the LoanHistoryList language for returned loans.
//
// COMPONENT-ONLY: no borrower route is registered this phase — Phase 9 (BORR-03)
// mounts this. Mutations invalidate the ["loans", wsId] prefix (useLoanMutations
// onSettled), which covers the by-borrower + by-item + list keys.

export interface BorrowerLoanPanelsProps {
  wsId: string;
  borrowerId: string;
}

export function BorrowerLoanPanels({
  wsId,
  borrowerId,
}: BorrowerLoanPanelsProps) {
  const { data } = useBorrowerLoans(wsId, borrowerId);
  const active = useMemo(() => data?.active ?? [], [data]);
  const history = useMemo(() => data?.history ?? [], [data]);

  return (
    <div className="flex flex-col gap-sp-4">
      <ActiveLoansPanel active={active} />
      <BorrowerLoanHistory history={history} />
    </div>
  );
}

interface ActiveLoansPanelProps {
  active: Loan[];
}

function ActiveLoansPanel({ active }: ActiveLoansPanelProps) {
  if (active.length === 0) {
    return (
      <Window title={<Trans>ACTIVE LOANS</Trans>} titlebarVariant="mint">
        <p className="text-[14px] font-semibold text-accent-mint-deep">
          <span aria-hidden="true">● </span>
          <Trans>Nothing out</Trans>
        </p>
      </Window>
    );
  }

  return (
    <Window title={<Trans>ACTIVE LOANS</Trans>} titlebarVariant="pink">
      <ul className="flex flex-col gap-sp-2">
        {active.map((loan) => (
          <ActiveLoanRow key={loan.id} loan={loan} />
        ))}
      </ul>
    </Window>
  );
}

interface ActiveLoanRowProps {
  loan: Loan;
}

function ActiveLoanRow({ loan }: ActiveLoanRowProps) {
  const [openDialog, setOpenDialog] = useState<"return" | "extend" | null>(null);
  const status = loanStatus(loan);

  return (
    <li className="flex flex-wrap items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2">
      <Link
        to={`/items/${loan.item.id}`}
        className="text-[14px] font-semibold text-fg-ink underline-offset-2 hover:underline"
      >
        {loan.item.name}
      </Link>
      <DueChip loan={loan} />
      <span className="flex-1" />
      <StatusPill variant={status.variant}>{status.label}</StatusPill>
      <BevelButton type="button" onClick={() => setOpenDialog("return")}>
        <Trans>RETURN</Trans>
      </BevelButton>
      <BevelButton type="button" onClick={() => setOpenDialog("extend")}>
        <Trans>EXTEND</Trans>
      </BevelButton>

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
    </li>
  );
}

/**
 * The due chip. Overdue/not is SERVER-authoritative (loan.is_overdue, override 2);
 * the day magnitude is display-only formatting derived from due_date. Danger
 * `⚠ −{n}d` when overdue, neutral `due in {n}d` otherwise.
 */
function DueChip({ loan }: { loan: Loan }) {
  if (!loan.due_date) return null;
  const days = daysFromNow(loan.due_date);
  if (loan.is_overdue) {
    return (
      <StatusPill variant="danger">
        <Trans>⚠ −{Math.abs(days)}d</Trans>
      </StatusPill>
    );
  }
  return (
    <span className="font-mono text-[12px] tabular-nums text-fg-muted">
      <Trans>due in {Math.max(days, 0)}d</Trans>
    </span>
  );
}

interface BorrowerLoanHistoryProps {
  history: Loan[];
}

function BorrowerLoanHistory({ history }: BorrowerLoanHistoryProps) {
  // I18N-03: history dates honor the user's date_format preference.
  const formatDate = useDateFormat();
  if (history.length === 0) {
    return (
      <Window title={<Trans>LOAN HISTORY</Trans>} titlebarVariant="plain">
        <RetroEmptyState
          eyebrow={<Trans>Loans</Trans>}
          heading={<Trans>NO LOAN HISTORY</Trans>}
          body={<Trans>This borrower hasn't returned anything yet.</Trans>}
        />
      </Window>
    );
  }

  return (
    <Window title={<Trans>LOAN HISTORY</Trans>} titlebarVariant="plain">
      <ul className="flex flex-col gap-sp-2">
        {history.map((loan) => {
          const status = loanStatus(loan);
          return (
            <li
              key={loan.id}
              className="flex flex-wrap items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2"
            >
              <Link
                to={`/items/${loan.item.id}`}
                className="text-[14px] font-semibold text-fg-ink underline-offset-2 hover:underline"
              >
                {loan.item.name}
              </Link>
              <span className="flex-1" />
              <span className="font-mono text-[12px] tabular-nums text-fg-muted">
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
    </Window>
  );
}

// Display-only day delta for the due chip MAGNITUDE. The overdue DECISION is
// server-owned (loan.is_overdue) — this number never drives that branch.
function daysFromNow(iso: string): number {
  const due = new Date(iso).getTime();
  if (Number.isNaN(due)) return 0;
  return Math.round((due - Date.now()) / 86_400_000);
}
