import { useCallback, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  RetroTable,
  RetroEmptyState,
  RetroPagination,
  FilterBar,
} from "@/components/retro";
import { useShortcuts } from "@/components/shortcuts";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import {
  useBorrowersQuery,
  BORROWERS_PER_PAGE,
} from "./hooks/useBorrowersQuery";

// Phase 9 Plan 02 — the /borrowers list surface (BORR-01). Mirrors
// InventoryListPage / LoansListPage density: a mint Window with a FilterBar
// (client search + count + NEW BORROWER CTA), a RetroTable (Name / Contact /
// Loans / row actions), and a RetroPagination fed a CLIENT-computed pageCount.
//
// Data strategy (OQ2 / binding override #2): useBorrowersQuery does ONE ≤100
// fetch then filters + pages ENTIRELY in the client — the page never calls
// /borrowers/search and never reads a server `total`. The `Loans` column is a
// muted "—" placeholder (OQ7 / binding override #2: NO per-row loan-count
// fan-out; the live count lives on the detail page in plan 09-03).
//
// RENDER-LOOP GUARD (CONTEXT constraint 5, hit 4× in prior phases): useLingui()'s
// `t` is NOT referentially stable — read it through a live ref inside the
// shortcut-binding closures so the shortcut memo depends on STABLE callbacks
// ONLY, never `t`. Mirrors InventoryListPage exactly.

export function BorrowersListPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  // Client search (name + email substring) — applied INSIDE useBorrowersQuery;
  // it does NOT round-trip to the URL (matches the inventory/loans convention).
  const [search, setSearch] = useState("");

  const { rows, page, pageCount, isLoading, isError } =
    useBorrowersQuery(search);

  // ── Route shortcuts (N → new, / → focus search). Labels via the `t` macro
  // directly; the memo keys on the resolved strings (stable within a locale,
  // re-runs on language switch) so the register effect never loops.
  const goNew = useCallback(() => navigate("/borrowers/new"), [navigate]);
  const focusSearch = useCallback(() => {
    document.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }, []);
  const labelNew = t`New borrower`;
  const labelSearch = t`Focus search`;
  const routeShortcuts = useMemo(
    () => [
      { key: "N", label: labelNew, action: goNew },
      { key: "/", label: labelSearch, action: focusSearch },
    ],
    [goNew, focusSearch, labelNew, labelSearch],
  );
  useShortcuts("borrowers", routeShortcuts);

  function clearSearch() {
    setSearch("");
  }

  function renderEmpty() {
    if (search.trim()) {
      return (
        <RetroEmptyState
          eyebrow={<Trans>Borrowers</Trans>}
          glyph="☺"
          heading={<Trans>NO MATCHES</Trans>}
          body={<Trans>No borrowers match this search.</Trans>}
          action={{ label: <Trans>CLEAR ALL</Trans>, onClick: clearSearch }}
        />
      );
    }
    return (
      <RetroEmptyState
        eyebrow={<Trans>Borrowers</Trans>}
        glyph="☺"
        heading={<Trans>NO BORROWERS</Trans>}
        body={
          <Trans>
            No borrowers yet. Add a borrower to start tracking who has your
            items.
          </Trans>
        }
        action={{ label: <Trans>⊕ ADD BORROWER</Trans>, onClick: goNew }}
      />
    );
  }

  // After client filtering, the page can be visibly empty (a search narrowed
  // every row out) even when the loaded set carried borrowers.
  const showEmpty = !isLoading && !isError && rows.length === 0;

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`BORROWERS — ${workspaceName}`} titlebarVariant="mint">
        <FilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t`Filter borrowers…`}
          itemCount={rows.length}
          // Borrowers have no enum facets (no status/condition) — 09-UI-SPEC
          // §Surface 1. The FilterBar still renders search + count + CTA.
          facets={[]}
          filterChips={[]}
          onRemoveFilter={() => {}}
          onClearAll={clearSearch}
          primaryAction={
            <BevelButton variant="mint" onClick={goNew}>
              <Trans>⊕ NEW BORROWER</Trans>
            </BevelButton>
          }
        />

        {isLoading && (
          <p className="p-sp-4 font-mono text-[13px] text-fg-muted">
            <Trans>Loading…</Trans>
          </p>
        )}

        {isError && (
          <p className="p-sp-4 text-[13px] font-semibold text-danger">
            <Trans>Couldn't load borrowers. Try again.</Trans>
          </p>
        )}

        {showEmpty && <div className="p-sp-4">{renderEmpty()}</div>}

        {!isLoading && !isError && rows.length > 0 && (
          <>
            <RetroTable>
              <thead>
                <tr>
                  <th>{t`Name`}</th>
                  <th>{t`Contact`}</th>
                  <th>{t`Loans`}</th>
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {rows.map((borrower) => {
                  // Contact: email if present, else phone, else muted "—".
                  const contact = borrower.email ?? borrower.phone;
                  return (
                    <tr
                      key={borrower.id}
                      onClick={() => navigate(`/borrowers/${borrower.id}`)}
                      className="cursor-pointer"
                    >
                      <td className="font-semibold">{borrower.name}</td>
                      <td className="font-mono text-[13px]">
                        {contact ?? (
                          <span className="text-fg-muted">—</span>
                        )}
                      </td>
                      {/* OQ7 / binding override #2: NO per-row loan-count
                          fan-out — the list shows a muted placeholder; the live
                          count lives on the detail page (plan 09-03). */}
                      <td className="text-fg-muted">—</td>
                      <td
                        className="actions text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <BevelButton
                          onClick={() =>
                            navigate(`/borrowers/${borrower.id}/edit`)
                          }
                        >
                          <Trans>EDIT</Trans>
                        </BevelButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </RetroTable>

            <RetroPagination
              page={page}
              pageCount={Math.max(1, pageCount)}
              perPage={BORROWERS_PER_PAGE}
              onPageChange={(p) =>
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("page", String(p));
                  return next;
                })
              }
            />
          </>
        )}
      </Window>
    </div>
  );
}
