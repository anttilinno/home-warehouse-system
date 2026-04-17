import { Link } from "react-router";
import { useLingui } from "@lingui/react/macro";
import {
  RetroPanel,
  RetroEmptyState,
  RetroButton,
  HazardStripe,
} from "@/components/retro";
import { ItemThumbnailCell } from "@/features/items/photos/ItemThumbnailCell";
import { useLoansForBorrower } from "../hooks/useLoansForBorrower";

/**
 * BorrowerLoanHistoryPanel — /borrowers/:id LOAN HISTORY section.
 *
 * Reads `history` from useLoansForBorrower (partitioned + sorted most-recent-
 * first). Thumbnails are dimmed to match the gray treatment of history rows.
 */
interface BorrowerLoanHistoryPanelProps {
  borrowerId: string;
}

export function BorrowerLoanHistoryPanel({
  borrowerId,
}: BorrowerLoanHistoryPanelProps) {
  const { t } = useLingui();
  const query = useLoansForBorrower(borrowerId);

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

  const history = query.history;
  if (history.length === 0) {
    return (
      <RetroEmptyState
        title={t`NO LOAN HISTORY`}
        body={t`Past loans will appear here once anything is returned.`}
      />
    );
  }

  return (
    <RetroPanel>
      <ul className="flex flex-col divide-y-2 divide-retro-charcoal">
        {history.map((loan) => (
          <li
            key={loan.id}
            className="flex items-center gap-md py-sm text-retro-gray flex-wrap"
          >
            <ItemThumbnailCell
              thumbnailUrl={loan.item.primary_photo_thumbnail_url}
              size={24}
              dimmed
            />
            <Link
              to={`/items/${loan.item.id}`}
              className="font-sans underline flex-1 min-w-0"
            >
              {loan.item.name}
            </Link>
            <span className="font-mono">×{loan.quantity}</span>
            <span className="font-sans font-semibold uppercase text-[14px]">
              {t`LOANED`}
            </span>
            <span className="font-mono">{loan.loaned_at.slice(0, 10)}</span>
            <span className="font-sans font-semibold uppercase text-[14px]">
              {t`RETURNED`}
            </span>
            <span className="font-mono">
              {loan.returned_at
                ? loan.returned_at.slice(0, 16).replace("T", " ")
                : "—"}
            </span>
          </li>
        ))}
      </ul>
    </RetroPanel>
  );
}
