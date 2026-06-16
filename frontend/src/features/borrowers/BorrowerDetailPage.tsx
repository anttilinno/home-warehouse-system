import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import {
  Window,
  BevelButton,
  RetroBadge,
  RetroEmptyState,
  RetroConfirmDialog,
  retroToast,
} from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { HttpError } from "@/lib/api";
import { borrowersApi } from "@/lib/api/borrowers";
import { BorrowerLoanPanels } from "@/features/loans/components/BorrowerLoanPanels";
import { useBorrowerLoans } from "@/features/loans/hooks/useBorrowerLoans";
import { useBorrowerMutations } from "./hooks/useBorrowerMutations";

// Phase 9 Plan 03 — borrower detail page (`/borrowers/:id`, BORR-03 + BORR-05).
//
// CLONES ItemDetailPage: a mint Window titled with the borrower name, an
// `actions` slot (EDIT + DELETE…), an HttpError-404 → not-found empty state, and
// a delete confirm. The profile is a compact <dl> (the ItemDetailPage Field /
// Muted pattern). Below it we MOUNT the shipped Phase-8 <BorrowerLoanPanels>
// (Active + History Windows) — that component is DONE, we only mount it.
//
// DELETE GUARD (BORR-05 — the one genuinely new affordance):
//   activeCount = useBorrowerLoans(...).data?.active.length ?? 0 — the SAME hook
//   BorrowerLoanPanels uses, so the read is from the shared RQ cache (no extra
//   fetch). When activeCount > 0:
//     1. the titlebar DELETE… button is disabled + aria-disabled,
//     2. a red RetroBadge (⚠ Active loans) sits beside it,
//     3. an inline danger banner with a "View active loans" link (/loans?tab=active)
//        renders between the profile and the panels.
//   The reactive 400 backstop already lives in useBorrowerMutations().del.onError
//   (09-01) — the page need not re-map it; it only surfaces the toast.
//
// Delete confirm is a PLAIN pink RetroConfirmDialog (NOT type-to-confirm — OQ6):
// borrowers carry no irreplaceable child data and the active-loan guard already
// blocks the dangerous case. navigate("/borrowers") lives at THIS call site —
// the shared 09-01 hook owns only the toast + 400 mapping, never routing.

export function BorrowerDetailPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const { currentWorkspaceId: wsId } = useWorkspace();
  const { id } = useParams();

  const borrowerQuery = useQuery({
    queryKey: ["borrowers", wsId as string, "detail", id],
    queryFn: () => borrowersApi.get(wsId as string, id as string),
    enabled: Boolean(wsId) && Boolean(id),
  });

  // The SAME hook BorrowerLoanPanels uses (shared cache, no extra fetch).
  const loansQuery = useBorrowerLoans(wsId as string, id as string);
  const activeCount = loansQuery.data?.active.length ?? 0;

  const { del } = useBorrowerMutations();
  // RQ v5 .mutate identity is stable — destructure (render-loop guard).
  const deleteBorrower = del.mutate;

  const borrower = borrowerQuery.data;

  // A 404 means the borrower was deleted/never existed → the not-found state,
  // NOT a load error. Every other failure → the error state + a persistent toast.
  const notFound =
    borrowerQuery.isError &&
    borrowerQuery.error instanceof HttpError &&
    borrowerQuery.error.status === 404;
  const loadError = borrowerQuery.isError && !notFound;

  // Resolve via the `t` macro directly (ref-indirected `tRef.current`…`` isn't a
  // valid macro call → empty string). Stable within a locale → effect deps stay
  // stable.
  const loadErrorMsg = t`Couldn't load this borrower.`;
  useEffect(() => {
    if (loadError) {
      retroToast.error(loadErrorMsg);
    }
  }, [loadError, loadErrorMsg]);

  const [deleteOpen, setDeleteOpen] = useState(false);

  // ── Not-found / error full-window states (before any chrome).
  if (loadError) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Window title={t`BORROWER`} titlebarVariant="mint">
          <RetroEmptyState
            eyebrow={<Trans>Borrowers</Trans>}
            heading={<Trans>COULDN'T LOAD BORROWER</Trans>}
            body={<Trans>Something went wrong. Try again.</Trans>}
            action={{
              label: <Trans>RETRY</Trans>,
              onClick: () => borrowerQuery.refetch(),
            }}
          />
        </Window>
      </div>
    );
  }

  if (notFound || (!borrowerQuery.isLoading && !borrower)) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Window title={t`BORROWER`} titlebarVariant="mint">
          <RetroEmptyState
            eyebrow={<Trans>Borrowers</Trans>}
            heading={<Trans>BORROWER NOT FOUND</Trans>}
            body={
              <Trans>
                This borrower may have been deleted. Return to the borrowers
                list.
              </Trans>
            }
            action={{
              label: <Trans>← BACK TO BORROWERS</Trans>,
              onClick: () => navigate("/borrowers"),
            }}
          />
        </Window>
      </div>
    );
  }

  if (borrowerQuery.isLoading || !borrower) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Window title={t`BORROWER`} titlebarVariant="mint">
          <p className="p-sp-4 font-mono text-13 text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        </Window>
      </div>
    );
  }

  const blocked = activeCount > 0;

  return (
    <div className="mx-auto max-w-[1280px]">
      <Window
        title={borrower.name}
        titlebarVariant="mint"
        actions={
          <span className="flex items-center gap-sp-1">
            {blocked && (
              <RetroBadge variant="danger">
                <Trans>⚠ Active loans</Trans>
              </RetroBadge>
            )}
            <BevelButton
              className="!px-[8px] !py-[2px] !text-11"
              onClick={() => navigate(`/borrowers/${borrower.id}/edit`)}
            >
              <Trans>EDIT</Trans>
            </BevelButton>
            <BevelButton
              variant="danger"
              className="!px-[8px] !py-[2px] !text-11"
              disabled={blocked}
              aria-disabled={blocked || undefined}
              onClick={() => {
                if (blocked) return;
                setDeleteOpen(true);
              }}
            >
              <Trans>DELETE…</Trans>
            </BevelButton>
          </span>
        }
      >
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

          {/* The shipped Phase-8 loan panels — DO NOT MODIFY, only mount. */}
          <div id="active-loans">
            <BorrowerLoanPanels
              wsId={wsId as string}
              borrowerId={borrower.id}
            />
          </div>
        </div>
      </Window>

      {/* Delete confirm — plain pink confirm (NOT type-to-confirm, OQ6). */}
      <RetroConfirmDialog
        open={deleteOpen}
        title={<Trans>DELETE BORROWER?</Trans>}
        titlebarVariant="pink"
        confirmLabel={<Trans>DELETE</Trans>}
        cancelLabel={<Trans>Cancel</Trans>}
        onConfirm={() => {
          // navigate lives at THIS call site; the hook owns only the toast +
          // 400 mapping (the reactive backstop), never routing.
          deleteBorrower(borrower.id, {
            onSuccess: () => navigate("/borrowers"),
          });
          setDeleteOpen(false);
        }}
        onCancel={() => setDeleteOpen(false)}
        onClose={() => setDeleteOpen(false)}
      >
        <Trans>Delete {borrower.name}? This can't be undone.</Trans>
      </RetroConfirmDialog>
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
