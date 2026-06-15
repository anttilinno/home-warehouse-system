import { Trans } from "@lingui/react/macro";
import { Window } from "@/components/retro";
import { useWorkspace } from "@/features/workspace/useWorkspace";
import { useAnalyticsSummary } from "./hooks/useAnalyticsSummary";
import { useMonthlyLoanActivity } from "./hooks/useMonthlyLoanActivity";
import { useOutOfStock } from "./hooks/useOutOfStock";
import { CategoryValueChart } from "./components/CategoryValueChart";
import { LocationValueChart } from "./components/LocationValueChart";
import { ConditionDonutChart } from "./components/ConditionDonutChart";
import { StatusStackChart } from "./components/StatusStackChart";
import { TopBorrowersChart } from "./components/TopBorrowersChart";
import { MonthlyLoanActivityChart } from "./components/MonthlyLoanActivityChart";
import { OutOfStockTable } from "./components/OutOfStockTable";

// Retro-os analytics (sketch 009): the six charts + out-of-stock table over the
// analytics summary. Lives INSIDE AppShell — renders the route body only; the
// auth guard is RequireAuth (the AppShell layout route).
//
// THIN composition: each chart owns its own retro Window + empty state (13b-02's
// RetroChartFrame) and the table owns its own Window + empty state (13b-03), so
// this page must NOT re-wrap them or duplicate empty-state logic. It only routes
// each sub-array slice to its chart.
//
// DATA SOURCES: the FIRST FIVE charts read slices of useAnalyticsSummary(12).
// The monthly chart reads useMonthlyLoanActivity(12) — the SEPARATE endpoint —
// because the summary's monthly_loan_activity is ALWAYS empty (backend never
// populates it). The out-of-stock table reads useOutOfStock(). Each `?? []`
// lets a chart render its own empty state on no-workspace / loading without a
// page-level spinner that would hide the grid (T-13b-07).
export function AnalyticsPage() {
  // wsId is the D-12 SSOT (AUTH-06): the analytics hooks read it internally and
  // are `enabled: Boolean(wsId)`, so nothing fires before a workspace exists
  // (T-13b-08). The page only needs `workspaces` here for the empty-state guard.
  const { workspaces } = useWorkspace();

  const { data: summary } = useAnalyticsSummary(12);
  const { items: monthly } = useMonthlyLoanActivity(12);
  const { items: outOfStock, isLoading: outOfStockLoading } = useOutOfStock();

  // Workspace empty-state (mirror DashboardPage): when the account has zero
  // workspaces, render the centered empty-state main and fire no analytics
  // requests (the hooks are gated on wsId, which is null here).
  if (workspaces && workspaces.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center p-sp-4">
        <Window title={<Trans>No workspace</Trans>} titlebarVariant="butter">
          <p className="text-13">
            <Trans>Your account has no workspaces yet.</Trans>
          </p>
        </Window>
      </main>
    );
  }

  return (
    <main className="mx-auto min-w-0 max-w-[1280px]">
      {/* The six charts in a responsive grid of retro Windows: two columns on
          wide, collapsing to one column on narrow (CONTEXT desktop-first). The
          monthly chart spans both columns — it is a wide time series. */}
      <section className="grid grid-cols-1 gap-sp-5 xl:grid-cols-2 [&>*]:min-w-0">
        <CategoryValueChart data={summary?.category_stats ?? []} />
        <LocationValueChart data={summary?.location_values ?? []} />
        <ConditionDonutChart data={summary?.condition_breakdown ?? []} />
        <StatusStackChart data={summary?.status_breakdown ?? []} />
        <TopBorrowersChart data={summary?.top_borrowers ?? []} />
        <div className="xl:col-span-2">
          <MonthlyLoanActivityChart data={monthly} />
        </div>
      </section>

      {/* ANL-04: the out-of-stock table below the charts (pink attention
          surface — the table owns its own Window + empty state). */}
      <div className="mt-sp-5">
        <OutOfStockTable items={outOfStock} isLoading={outOfStockLoading} />
      </div>
    </main>
  );
}
