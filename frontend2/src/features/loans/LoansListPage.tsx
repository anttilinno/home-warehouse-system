import { useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import {
  RetroButton,
  RetroPanel,
  RetroEmptyState,
  RetroTabs,
  RetroPagination,
  HazardStripe,
} from "@/components/retro";
import { Plus } from "./icons";
import { useAuth } from "@/features/auth/AuthContext";
import { useHashTab } from "@/features/taxonomy/hooks/useHashTab";
import { useLoansActive } from "./hooks/useLoansActive";
import { useLoansOverdue } from "./hooks/useLoansOverdue";
import { useLoansHistory } from "./hooks/useLoansHistory";
import { LoansTable } from "./table/LoansTable";
import { LoanPanel, type LoanPanelHandle } from "./panel/LoanPanel";
import {
  LoanReturnFlow,
  type LoanReturnFlowHandle,
} from "./actions/LoanReturnFlow";
import { useLoansListQueryParams } from "./filters/useLoansListQueryParams";
import type { Loan } from "@/lib/api/loans";

const TAB_KEYS = ["active", "overdue", "history"] as const;
type TabKey = (typeof TAB_KEYS)[number];
const HISTORY_PAGE_SIZE = 25;

/**
 * LoansListPage — /loans route component (Phase 62-03).
 *
 * Implements LOAN-01..LOAN-04 user-reachable surface:
 *   - LOAN-01: tabbed list (ACTIVE / OVERDUE / HISTORY) with counters, hash-synced
 *   - LOAN-02: + NEW LOAN opens LoanPanel in create mode
 *   - LOAN-03: MARK RETURNED opens LoanReturnFlow single-step confirm
 *   - LOAN-04: EDIT opens LoanPanel in edit mode (due date + notes only)
 *
 * Three parallel queries fire on mount so every tab shows its counter on
 * first paint (D-07 / UI-SPEC). Counter reads `data.items.length` — the
 * backend endpoints for ACTIVE and OVERDUE are unpaginated, and HISTORY is
 * paginated but its count here is the current-page size (good enough for
 * the tab chip; a dedicated total could be wired later if backend exposes).
 *
 * Pagination (HISTORY only) uses a heuristic: when the current page is full
 * (items.length >= HISTORY_PAGE_SIZE), render RetroPagination with a
 * "might-have-more" total of items-seen + 1 so the next-page button remains
 * enabled. When a short page arrives the pagination auto-hides. RetroPagination
 * already short-circuits on `totalCount <= pageSize`.
 */
export function LoansListPage() {
  const { t } = useLingui();
  const { workspaceId, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useHashTab<TabKey>("active", TAB_KEYS);
  const [ui, updateUi] = useLoansListQueryParams();

  const activeQuery = useLoansActive();
  const overdueQuery = useLoansOverdue();
  const historyQuery = useLoansHistory({
    page: ui.page,
    limit: HISTORY_PAGE_SIZE,
  });

  const panelRef = useRef<LoanPanelHandle>(null);
  const returnFlowRef = useRef<LoanReturnFlowHandle>(null);

  if (authLoading) return null;

  const handleNew = () => panelRef.current?.open("create");
  const handleEdit = (loan: Loan) => panelRef.current?.open("edit", loan);
  const handleMarkReturned = (loan: Loan) =>
    returnFlowRef.current?.open(loan);

  const activeCount = activeQuery.data?.items.length;
  const overdueCount = overdueQuery.data?.items.length;
  const historyCount = historyQuery.data?.items.length;
  const formatLabel = (base: string, n: number | undefined) =>
    n === undefined ? `${base} · …` : `${base} · ${n}`;

  const currentQuery =
    tab === "active"
      ? activeQuery
      : tab === "overdue"
        ? overdueQuery
        : historyQuery;
  const currentLoans: Loan[] = currentQuery.data?.items ?? [];

  const tabPanelId = `tabpanel-${tab}`;

  // History pagination heuristic (see component jsdoc).
  const historyFullPage = currentLoans.length >= HISTORY_PAGE_SIZE;
  const historyTotalHint =
    (ui.page - 1) * HISTORY_PAGE_SIZE + currentLoans.length + 1;

  return (
    <div className="flex flex-col gap-lg p-lg min-w-0">
      <div className="flex items-center justify-between gap-md flex-wrap">
        <h1 className="text-[20px] font-semibold uppercase tracking-wider text-retro-ink">
          {t`LOANS`}
        </h1>
        <RetroButton variant="primary" onClick={handleNew}>
          <Plus size={14} />
          {t`+ NEW LOAN`}
        </RetroButton>
      </div>

      <RetroTabs
        tabs={[
          { key: "active", label: formatLabel(t`ACTIVE`, activeCount) },
          { key: "overdue", label: formatLabel(t`OVERDUE`, overdueCount) },
          { key: "history", label: formatLabel(t`HISTORY`, historyCount) },
        ]}
        activeTab={tab}
        onTabChange={(k) => {
          setTab(k as TabKey);
          updateUi({ page: 1 });
        }}
      />

      <div role="tabpanel" id={tabPanelId} aria-labelledby={`tab-${tab}`}>
        {workspaceId && currentQuery.isPending && (
          <RetroPanel>
            <p className="font-mono text-retro-charcoal">{t`Loading…`}</p>
          </RetroPanel>
        )}

        {workspaceId && currentQuery.isError && (
          <RetroPanel>
            <HazardStripe className="mb-md" />
            <h2 className="text-[20px] font-bold uppercase text-retro-ink mb-sm">
              {t`COULD NOT LOAD LOANS`}
            </h2>
            <p className="text-retro-ink mb-md">
              {t`Check your connection and try again.`}
            </p>
            <RetroButton
              variant="primary"
              onClick={() => currentQuery.refetch()}
            >
              {t`RETRY`}
            </RetroButton>
          </RetroPanel>
        )}

        {workspaceId &&
          currentQuery.isSuccess &&
          currentLoans.length === 0 &&
          tab === "active" && (
            <RetroEmptyState
              title={t`NO ACTIVE LOANS`}
              body={t`Nothing is currently out on loan.`}
              action={
                <RetroButton variant="primary" onClick={handleNew}>
                  {t`+ NEW LOAN`}
                </RetroButton>
              }
            />
          )}
        {workspaceId &&
          currentQuery.isSuccess &&
          currentLoans.length === 0 &&
          tab === "overdue" && (
            <RetroEmptyState
              title={t`NO OVERDUE LOANS`}
              body={t`Nothing is past its due date. Nice.`}
            />
          )}
        {workspaceId &&
          currentQuery.isSuccess &&
          currentLoans.length === 0 &&
          tab === "history" && (
            <RetroEmptyState
              title={t`NO LOAN HISTORY`}
              body={t`Returned loans will appear here.`}
            />
          )}

        {workspaceId &&
          currentQuery.isSuccess &&
          currentLoans.length > 0 && (
            <RetroPanel>
              <LoansTable
                tab={tab}
                loans={currentLoans}
                onEdit={handleEdit}
                onMarkReturned={handleMarkReturned}
              />
            </RetroPanel>
          )}

        {tab === "history" && historyFullPage && (
          <RetroPagination
            page={ui.page}
            pageSize={HISTORY_PAGE_SIZE}
            totalCount={historyTotalHint}
            onChange={(p) => updateUi({ page: p })}
          />
        )}
      </div>

      <LoanPanel ref={panelRef} />
      <LoanReturnFlow ref={returnFlowRef} />
    </div>
  );
}
