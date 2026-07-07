import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  Window,
  BevelButton,
  PixelIcon,
  RetroTable,
  RetroTabs,
  RetroEmptyState,
  StatusPill,
  FilterBar,
  retroToast,
} from "@/components/retro";
import { useShortcuts } from "@/components/shortcuts";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import type { Loan } from "@/lib/types";
import { loanStatus } from "./loanStatus";
import { loansToCsvBlob, triggerCsvDownload } from "./loanCsv";
import { useLoansQuery, type LoansTab } from "./hooks/useLoansQuery";
import { LoanRowActions } from "./components/LoanRowActions";

// Phase 8 Plan 02 — the /loans tabbed list surface (LOAN-01). Mirrors
// InventoryListPage's density / FilterBar / RetroTable composition and its
// render-loop guard (tRef + stable shortcut deps). RetroTabs folders
// Active/Overdue/History are URL-driven (`?tab=`, default active); each tab's
// content is the same table bound to that tab's endpoint via useLoansQuery.
// Overdue rows carry THREE non-color cues (bg-danger-bg tint + danger Overdue
// pill word + `⚠ −{n}d` chip — UI-SPEC §Overdue-row highlight). Per-tab CSV is
// CLIENT-generated from the already-fetched rows (override 3 — no backend
// export). Row lifecycle actions are a stable <LoanRowActions/> slot (Plan 04
// wires the dialogs; same path + props, no change needed here).

const TABS: { id: LoansTab; label: ReactNode }[] = [
  { id: "active", label: <Trans>ACTIVE</Trans> },
  { id: "overdue", label: <Trans>OVERDUE</Trans> },
  { id: "history", label: <Trans>HISTORY</Trans> },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole-day delta from now to a due date (positive = days remaining). */
function daysUntil(due: string): number {
  return Math.round((new Date(due).getTime() - Date.now()) / DAY_MS);
}

function isoDate(value?: string): string {
  return value ? value.slice(0, 10) : "—";
}

export function LoansListPage() {
  const { t } = useLingui();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { currentWorkspaceId: wsId, workspaces } = useWorkspace();

  const { items, isLoading, isError, tab } = useLoansQuery();

  const workspaceName =
    workspaces?.find((w) => w.id === wsId)?.name ?? t`Workspace`;

  // ── Client-side search (item OR borrower name substring) — does NOT round-trip
  // to the URL (matches the inventory client-filter convention).
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((l) => {
      const item = (l.item?.name ?? "").toLowerCase();
      const borrower = (l.borrower?.name ?? "").toLowerCase();
      return item.includes(q) || borrower.includes(q);
    });
  }, [items, search]);

  const setTab = useCallback(
    (id: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", id);
        return next;
      });
    },
    [setSearchParams],
  );

  // ── Route shortcuts (N → new, / → focus search). Labels via the `t` macro
  // directly; the memo keys on the resolved strings (stable within a locale,
  // re-runs on language switch) so the register effect never loops.
  const goNew = useCallback(() => navigate("/loans/new"), [navigate]);
  const focusSearch = useCallback(() => {
    document.querySelector<HTMLInputElement>("[data-search-input]")?.focus();
  }, []);
  const labelNew = t`New loan`;
  const labelSearch = t`Focus search`;
  const routeShortcuts = useMemo(
    () => [
      { key: "N", label: labelNew, action: goNew },
      { key: "/", label: labelSearch, action: focusSearch },
    ],
    [goNew, focusSearch, labelNew, labelSearch],
  );
  useShortcuts("loans", routeShortcuts);

  // ── Per-tab CSV export (override 3 — built in-memory from the current rows).
  const nothingToExport = t`Nothing to export.`;
  const exportCsv = useCallback(() => {
    if (visible.length === 0) {
      retroToast.error(nothingToExport);
      return;
    }
    triggerCsvDownload(loansToCsvBlob(visible), `loans-${tab}.csv`);
  }, [visible, tab, nothingToExport]);

  function clearSearch() {
    setSearch("");
  }

  // ── Due-column cell (UI-SPEC §1 column 4). History shows returned-at; overdue
  // rows render the danger `⚠ −{n}d` chip (the third non-color cue).
  function renderDue(loan: Loan) {
    if (tab === "history" || loan.returned_at) {
      return (
        <span className="font-mono tabular-nums text-fg-muted">
          <Trans>returned {isoDate(loan.returned_at)}</Trans>
        </span>
      );
    }
    if (!loan.due_date) {
      return <span className="text-fg-muted">—</span>;
    }
    if (loan.is_overdue) {
      const overdueBy = Math.abs(daysUntil(loan.due_date));
      return (
        <span className="inline-flex items-center gap-[4px] rounded-chip border border-border-ink bg-danger-bg px-sp-2 py-px font-mono text-12 font-bold tabular-nums text-danger">
          <span aria-hidden="true">⚠</span>
          {t`−${overdueBy}d`}
        </span>
      );
    }
    const inDays = daysUntil(loan.due_date);
    return (
      <span className="font-mono tabular-nums text-fg-muted">
        {inDays >= 0 ? t`due in ${inDays}d` : t`due ${isoDate(loan.due_date)}`}
      </span>
    );
  }

  function renderEmpty() {
    if (search.trim()) {
      return (
        <RetroEmptyState
          eyebrow={<Trans>Loans</Trans>}
          glyph="download"
          heading={<Trans>NO MATCHES</Trans>}
          body={<Trans>No loans match this search.</Trans>}
          action={{
            label: <Trans>CLEAR SEARCH</Trans>,
            onClick: clearSearch,
          }}
        />
      );
    }
    if (tab === "overdue") {
      return (
        <RetroEmptyState
          eyebrow={<Trans>Loans</Trans>}
          glyph="download"
          heading={<Trans>NOTHING OVERDUE</Trans>}
          body={<Trans>No active loans are past their due date.</Trans>}
        />
      );
    }
    if (tab === "history") {
      return (
        <RetroEmptyState
          eyebrow={<Trans>Loans</Trans>}
          glyph="download"
          heading={<Trans>NO LOAN HISTORY</Trans>}
          body={<Trans>No loans have been returned yet.</Trans>}
        />
      );
    }
    return (
      <RetroEmptyState
        eyebrow={<Trans>Loans</Trans>}
        glyph="download"
        heading={<Trans>NO ACTIVE LOANS</Trans>}
        body={
          <Trans>
            Nothing is out on loan right now. Loan an item to start tracking it.
          </Trans>
        }
        action={{
          label: (
            <>
              <PixelIcon name="plus" size={16} /> <Trans>NEW LOAN</Trans>
            </>
          ),
          onClick: goNew,
        }}
      />
    );
  }

  const showEmpty = !isLoading && !isError && visible.length === 0;

  const tableContent = (
    <>
      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t`Filter loans…`}
        itemCount={visible.length}
        facets={[]}
        filterChips={[]}
        onRemoveFilter={() => {}}
        onClearAll={clearSearch}
        primaryAction={
          <span className="flex items-center gap-sp-2">
            <BevelButton
              onClick={exportCsv}
              disabled={visible.length === 0}
              aria-disabled={visible.length === 0 || undefined}
            >
              <PixelIcon name="download" size={16} /> <Trans>EXPORT CSV</Trans>
            </BevelButton>
            <BevelButton variant="mint" onClick={goNew}>
              <PixelIcon name="plus" size={16} /> <Trans>NEW LOAN</Trans>
            </BevelButton>
          </span>
        }
      />

      {isLoading && (
        <p className="p-sp-4 font-mono text-13 text-fg-muted">
          <Trans>Loading…</Trans>
        </p>
      )}

      {isError && (
        <p className="p-sp-4 text-13 font-semibold text-danger">
          <Trans>Couldn't load loans. Try again.</Trans>
        </p>
      )}

      {showEmpty && <div className="p-sp-4">{renderEmpty()}</div>}

      {!isLoading && !isError && visible.length > 0 && (
        <RetroTable>
          <thead>
            <tr>
              <th>{t`Item`}</th>
              <th>{t`Borrower`}</th>
              <th>{t`Loaned`}</th>
              <th>{t`Due`}</th>
              <th>{t`Status`}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visible.map((loan) => {
              const status = loanStatus(loan);
              let statusLabel: ReactNode;
              if (status.label === "OVERDUE") {
                statusLabel = <Trans>Overdue</Trans>;
              } else if (status.label === "RETURNED") {
                statusLabel = <Trans>Returned</Trans>;
              } else {
                statusLabel = <Trans>Active</Trans>;
              }
              return (
                <tr
                  key={loan.id}
                  onClick={() => navigate(`/items/${loan.item.id}`)}
                  className={`cursor-pointer ${
                    loan.is_overdue ? "bg-danger-bg" : ""
                  }`}
                >
                  <td className="font-semibold">{loan.item?.name ?? "—"}</td>
                  <td>{loan.borrower?.name ?? "—"}</td>
                  <td className="font-mono tabular-nums text-fg-muted">
                    {isoDate(loan.loaned_at)}
                  </td>
                  <td className="font-mono">{renderDue(loan)}</td>
                  <td>
                    <StatusPill variant={status.variant}>
                      {statusLabel}
                    </StatusPill>
                  </td>
                  {/* biome-ignore lint/a11y/useKeyWithClickEvents: stops row-click propagation only */}
                  <td
                    className="actions text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LoanRowActions loan={loan} tab={tab} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </RetroTable>
      )}
    </>
  );

  const tabs = TABS.map((definition) => ({
    id: definition.id,
    label: definition.label,
    // All tabs render the SAME table chrome — useLoansQuery already keys on the
    // active tab, so only the selected panel mounts (RetroTabs renders one).
    content: tableContent,
  }));

  return (
    <div className="mx-auto min-w-0 max-w-[1280px]">
      <Window title={t`LOANS — ${workspaceName}`} titlebarVariant="mint">
        <RetroTabs tabs={tabs} value={tab} onChange={setTab} />
      </Window>
    </div>
  );
}
