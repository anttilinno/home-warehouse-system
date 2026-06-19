import { Link } from "react-router";
import type { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import type { Borrower } from "@/lib/api/borrowers";

// Phase 9 refactor — the borrower profile block: the definition-grid (the
// ItemDetailPage Field/Muted pattern) plus the BORR-05 delete-blocked banner.
// Extracted from BorrowerDetailPage to lift the per-field empty ternaries and
// the banner guard out of the page body. The banner shows only when active
// loans block deletion.
export function BorrowerProfile({
  borrower,
  blocked,
}: Readonly<{ borrower: Borrower; blocked: boolean }>) {
  return (
    <div className="flex flex-col gap-sp-4">
      {/* Profile — definition grid (ItemDetailPage Field / Muted pattern). */}
      <dl className="grid grid-cols-[minmax(0,140px)_1fr] gap-x-sp-4 gap-y-sp-3">
        <Field label={<Trans>Name</Trans>}>{borrower.name}</Field>
        <Field label={<Trans>Email</Trans>} mono>
          {borrower.email ? borrower.email : <Muted>—</Muted>}
        </Field>
        <Field label={<Trans>Phone</Trans>} mono>
          {borrower.phone ? borrower.phone : <Muted>—</Muted>}
        </Field>
        <Field label={<Trans>Notes</Trans>}>
          {borrower.notes ? (
            <span className="whitespace-pre-wrap">{borrower.notes}</span>
          ) : (
            <Muted>—</Muted>
          )}
        </Field>
        <Field label={<Trans>Created</Trans>} mono muted>
          {borrower.created_at}
        </Field>
      </dl>

      {/* Delete-blocked banner (BORR-05) — only when active loans exist. */}
      {blocked && (
        <div
          role="status"
          className="flex items-center gap-sp-2 border-2 border-border-ink bg-danger-bg p-sp-3 text-14 text-danger"
        >
          <span aria-hidden="true">⚠</span>
          <span>
            <Trans>
              Return the active loans before deleting this borrower.
            </Trans>
          </span>
          <Link
            to="/loans?tab=active"
            className="text-danger underline underline-offset-2"
          >
            <Trans>View active loans</Trans>
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Profile field helpers — verbatim ItemDetailPage pattern.
function Field({
  label,
  children,
  mono,
  muted,
}: Readonly<{
  label: ReactNode;
  children: ReactNode;
  mono?: boolean;
  muted?: boolean;
}>) {
  return (
    <>
      <dt className="text-12 font-bold uppercase tracking-8 text-fg-muted">
        {label}
      </dt>
      <dd
        className={`text-14 ${mono ? "font-mono tabular-nums" : ""} ${
          muted ? "text-fg-muted" : "text-fg-ink"
        }`}
      >
        {children}
      </dd>
    </>
  );
}

function Muted({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="text-fg-muted">{children}</span>;
}
