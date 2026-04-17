import { Link, useParams } from "react-router";
import { useLingui } from "@lingui/react/macro";
import { useBorrower } from "./hooks/useBorrower";
import { ArrowLeft } from "./icons";
import {
  RetroPanel,
  RetroBadge,
  HazardStripe,
} from "@/components/retro";
import { BorrowerActiveLoansPanel } from "@/features/loans/panels/BorrowerActiveLoansPanel";
import { BorrowerLoanHistoryPanel } from "@/features/loans/panels/BorrowerLoanHistoryPanel";

export function BorrowerDetailPage() {
  const { t } = useLingui();
  const { id } = useParams<{ id: string }>();
  const borrowerQuery = useBorrower(id);

  if (borrowerQuery.isPending) {
    return (
      <RetroPanel>
        <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
      </RetroPanel>
    );
  }

  if (borrowerQuery.isError || !borrowerQuery.data) {
    return (
      <RetroPanel>
          <HazardStripe className="mb-md" />
          <h1 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
            {t`BORROWER NOT FOUND`}
          </h1>
          <p className="text-retro-ink mb-md">
            {t`This borrower may have been deleted.`}
          </p>
          <Link
            to="/borrowers"
            className="inline-flex items-center gap-xs font-mono text-[14px] text-retro-ink underline"
          >
            <ArrowLeft size={14} />
            {t`BACK TO BORROWERS`}
          </Link>
      </RetroPanel>
    );
  }

  const b = borrowerQuery.data;

  return (
    <div className="flex flex-col gap-lg p-lg">
      <Link
        to="/borrowers"
        className="inline-flex items-center gap-xs font-mono text-[14px] text-retro-ink"
      >
        <ArrowLeft size={14} />
        {t`BORROWERS`}
      </Link>

      <div className="border-l-2 border-retro-amber pl-md flex items-center gap-md flex-wrap">
        <h1 className="text-[24px] font-bold uppercase text-retro-ink">
          {b.name}
        </h1>
        {b.is_archived && (
          <RetroBadge variant="neutral" className="font-mono">
            {t`ARCHIVED`}
          </RetroBadge>
        )}
      </div>

      <RetroPanel>
        <h2 className="text-[14px] font-semibold uppercase tracking-wider text-retro-ink mb-md">
          {t`CONTACT`}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-lg gap-y-sm">
          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`EMAIL`}
          </dt>
          <dd
            className={`font-mono text-[16px] ${b.email ? "text-retro-ink" : "text-retro-gray"}`}
          >
            {b.email ? b.email : "—"}
          </dd>
          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`PHONE`}
          </dt>
          <dd
            className={`font-mono text-[16px] ${b.phone ? "text-retro-ink" : "text-retro-gray"}`}
          >
            {b.phone ? b.phone : "—"}
          </dd>
          <dt className="font-sans text-[14px] font-semibold uppercase text-retro-ink">
            {t`NOTES`}
          </dt>
          <dd
            className={`font-mono text-[16px] ${b.notes ? "text-retro-ink" : "text-retro-gray"}`}
          >
            {b.notes ? b.notes : "—"}
          </dd>
        </dl>
      </RetroPanel>

      <section aria-labelledby="active-loans-h2">
        <h2
          id="active-loans-h2"
          className="text-[20px] font-bold uppercase text-retro-ink mb-md"
        >
          {t`ACTIVE LOANS`}
        </h2>
        <BorrowerActiveLoansPanel borrowerId={b.id} />
      </section>

      <section aria-labelledby="loan-history-h2">
        <h2
          id="loan-history-h2"
          className="text-[20px] font-bold uppercase text-retro-ink mb-md"
        >
          {t`LOAN HISTORY`}
        </h2>
        <BorrowerLoanHistoryPanel borrowerId={b.id} />
      </section>
    </div>
  );
}
