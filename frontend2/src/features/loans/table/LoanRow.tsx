import type { ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle } from "../icons";
import { ItemThumbnailCell } from "@/features/items/photos/ItemThumbnailCell";
import type { Loan } from "@/lib/api/loans";
import { LoanRowActions } from "./LoanRowActions";

export interface LoanRowCellsProps {
  loan: Loan;
  tab: "active" | "overdue" | "history";
  onEdit: (l: Loan) => void;
  onMarkReturned: (l: Loan) => void;
}

/**
 * buildLoanRowCells — maps a Loan + tab into the Record<string, ReactNode>
 * shape that RetroTable consumes via `data={rows}`.
 *
 * Overdue-row emphasis: when `loan.is_overdue`, the DUE cell renders in
 * retro-red with an AlertTriangle icon; only the date cell is accented —
 * the rest of the row stays charcoal on cream (UI-SPEC §Typography).
 *
 * History rows: full row text in retro-gray; RETURNED cell formats the
 * `YYYY-MM-DD HH:MM` timestamp in mono (UI-SPEC §Typography).
 */
export function buildLoanRowCells({
  loan,
  tab,
  onEdit,
  onMarkReturned,
}: LoanRowCellsProps): Record<string, ReactNode> {
  const grayed = tab === "history";
  const rowTextClass = grayed ? "text-retro-gray" : "text-retro-ink";

  const thumb = (
    <ItemThumbnailCell
      thumbnailUrl={loan.item.primary_photo_thumbnail_url}
      dimmed={grayed}
    />
  );

  const itemCell = (
    <Link
      to={`/items/${loan.inventory_id}`}
      className={`font-sans no-underline ${rowTextClass}`}
    >
      {loan.item.name}
    </Link>
  );

  const borrowerCell = (
    <Link
      to={`/borrowers/${loan.borrower_id}`}
      className={`font-sans no-underline ${rowTextClass}`}
    >
      {loan.borrower.name}
    </Link>
  );

  const qty = (
    <span className={`font-mono ${rowTextClass}`}>×{loan.quantity}</span>
  );

  const loaned = (
    <span className={`font-mono ${rowTextClass}`}>
      {loan.loaned_at.slice(0, 10)}
    </span>
  );

  const due = loan.due_date ? (
    loan.is_overdue ? (
      <span className="inline-flex items-center gap-xs font-mono text-retro-red">
        <AlertTriangle size={16} />
        {loan.due_date.slice(0, 10)}
      </span>
    ) : (
      <span className={`font-mono ${rowTextClass}`}>
        {loan.due_date.slice(0, 10)}
      </span>
    )
  ) : (
    <span className="font-mono text-retro-gray">—</span>
  );

  const returned = loan.returned_at ? (
    <span className="font-mono text-retro-gray">
      {loan.returned_at.slice(0, 16).replace("T", " ")}
    </span>
  ) : (
    <span className="font-mono text-retro-gray">—</span>
  );

  const actions = (
    <LoanRowActions
      loan={loan}
      onEdit={onEdit}
      onMarkReturned={onMarkReturned}
    />
  );

  return {
    thumb,
    item: itemCell,
    borrower: borrowerCell,
    qty,
    loaned,
    due,
    returned,
    actions,
  };
}
