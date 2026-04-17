import { useLingui } from "@lingui/react/macro";
import { RetroTable } from "@/components/retro";
import type { Loan } from "@/lib/api/loans";
import { buildLoanRowCells } from "./LoanRow";

interface LoansTableProps {
  tab: "active" | "overdue" | "history";
  loans: Loan[];
  onEdit: (l: Loan) => void;
  onMarkReturned: (l: Loan) => void;
}

/**
 * LoansTable — tab-configurable columns on top of RetroTable.
 *
 * HISTORY tab columns (Pitfall 7 — tab-driven columns, NOT conditional
 * rendering inside a single column set):
 *   [thumb, ITEM, BORROWER, QTY, LOANED, RETURNED]  — no ACTIONS column
 *
 * ACTIVE + OVERDUE tab columns:
 *   [thumb, ITEM, BORROWER, QTY, LOANED, DUE, ACTIONS]
 *
 * The column shape is computed up-front (one ternary) and passed to the
 * primitive in a single pass, so the RetroTable doesn't need to know about
 * loan semantics.
 */
export function LoansTable({
  tab,
  loans,
  onEdit,
  onMarkReturned,
}: LoansTableProps) {
  const { t } = useLingui();

  const baseColumns = [
    {
      key: "thumb",
      header: <span className="sr-only">{t`Item thumbnail`}</span>,
      className: "w-14",
    },
    { key: "item", header: t`ITEM` },
    { key: "borrower", header: t`BORROWER` },
    { key: "qty", header: t`QTY`, className: "text-center" },
    { key: "loaned", header: t`LOANED` },
  ];

  const columns =
    tab === "history"
      ? [...baseColumns, { key: "returned", header: t`RETURNED` }]
      : [
          ...baseColumns,
          { key: "due", header: t`DUE` },
          { key: "actions", header: t`ACTIONS`, className: "text-right" },
        ];

  const rows = loans.map((loan) =>
    buildLoanRowCells({ loan, tab, onEdit, onMarkReturned }),
  );

  return <RetroTable columns={columns} data={rows} />;
}
