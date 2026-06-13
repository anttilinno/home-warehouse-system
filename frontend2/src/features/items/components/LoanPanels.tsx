import { useMemo } from "react";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  StatusPill,
  RetroEmptyState,
} from "@/components/retro";
import type { Loan } from "@/lib/types";
import { loansApi, type PartitionedLoans } from "@/lib/api/loans";

// Phase 7 Plan 06 — read-only per-item loan surfaces (UI-SPEC §2 side rail +
// HISTORY tab). The shared query (key ["loans", wsId, "by-item", itemId]) returns
// ALL loans partitioned client-side on is_active (07-RESEARCH OQ2). Loan CRUD is
// Phase 8 — the RETURN affordance is rendered disabled with the Phase-8 hint.

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
}

/**
 * The side-rail active-loan panel (UI-SPEC §2). Pink titlebar when on loan
 * (attention) with `● On loan to {borrower}` in text-accent-pink-deep + the due
 * date + a disabled RETURN (Phase-8 hint); mint `● Available` when no active loan.
 */
export function ActiveLoanPanel({ active }: ActiveLoanPanelProps) {
  const loan = active[0];

  if (!loan) {
    return (
      <Window title={<Trans>LOAN</Trans>} titlebarVariant="mint">
        <p className="text-[14px] font-semibold text-accent-mint-deep">
          <span aria-hidden="true">● </span>
          <Trans>Available</Trans>
        </p>
      </Window>
    );
  }

  return (
    <Window title={<Trans>LOAN</Trans>} titlebarVariant="pink">
      <div className="flex flex-col gap-sp-3">
        <p className="text-[14px] font-semibold text-accent-pink-deep">
          <span aria-hidden="true">● </span>
          <Trans>On loan to {loan.borrower.name}</Trans>
        </p>
        {loan.due_date && (
          <p className="font-mono text-[12px] tabular-nums text-fg-muted">
            <Trans>Due {formatDate(loan.due_date)}</Trans>
          </p>
        )}
        <div className="flex flex-col gap-sp-1">
          <BevelButton disabled aria-disabled="true">
            <Trans>RETURN</Trans>
          </BevelButton>
          <p className="text-[12px] text-fg-muted">
            <Trans>Loan actions arrive in Phase 8.</Trans>
          </p>
        </div>
      </div>
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
      {history.map((loan) => (
        <li
          key={loan.id}
          className="flex flex-wrap items-center gap-sp-2 border-2 border-border-ink bg-bg-panel-2 px-sp-3 py-sp-2"
        >
          <span className="text-[14px] font-semibold text-fg-ink">
            {loan.borrower.name}
          </span>
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
          <StatusPill variant={loan.is_active ? "info" : "ok"}>
            {loan.is_active ? <Trans>OUT</Trans> : <Trans>RETURNED</Trans>}
          </StatusPill>
        </li>
      ))}
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
  return <ActiveLoanPanel active={active} />;
}

// Locale-stable short date (the test asserts on the borrower/markers, not the
// exact format; this keeps output deterministic across environments).
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
