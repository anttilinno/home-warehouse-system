import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { MemoryRouter } from "react-router";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import type { Workspace } from "@/lib/types";
import type { WorkspaceContextValue } from "@/features/workspace/WorkspaceProvider";
import type {
  AnalyticsSummary,
  MonthlyLoanActivity,
  OutOfStockItem,
} from "@/features/analytics/types";

// Phase 13b Plan 04 (Wave 2) — AnalyticsPage composition. wsId comes from the
// D-12 useWorkspace() context (AUTH-06); mock it like DashboardPage.test. The
// page fires ONE summary query (four charts + top-borrowers), ONE monthly query
// (the monthly chart — summary never carries monthly), and ONE out-of-stock
// query (the table). recharts ResponsiveContainer needs a fixed box in jsdom
// (the charts.test pattern) or no chart SVG ever paints.

const useWorkspaceMock = vi.fn<() => WorkspaceContextValue>();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

// recharts ResponsiveContainer measures its parent with ResizeObserver and
// renders nothing until it has a non-zero box — jsdom always reports 0. Replace
// it with a fixed-size wrapper so the inner charts paint their marks. Same
// pattern as components/charts.test.tsx.
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 800, height: 400 }}>
        <actual.ResponsiveContainer width={800} height={400}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

import { AnalyticsPage } from "./AnalyticsPage";

const WS: Workspace[] = [
  {
    id: "ws-A",
    name: "Alpha",
    slug: "alpha",
    description: null,
    role: "owner",
    is_personal: true,
  },
];

function setContext(partial: Partial<WorkspaceContextValue> = {}) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId: "ws-A",
    setWorkspace: vi.fn(),
    workspaces: WS,
    isLoading: false,
    ...partial,
  });
}

const SUMMARY: AnalyticsSummary = {
  dashboard: null,
  loan_stats: null,
  category_stats: [
    { id: "c1", name: "Power tools", item_count: 412, inventory_count: 500, total_value: 1894000 },
    { id: "c2", name: "Hand tools", item_count: 288, inventory_count: 300, total_value: 712000 },
  ],
  location_values: [
    { id: "l1", name: "Garage", item_count: 120, total_quantity: 400, total_value: 1421000 },
  ],
  condition_breakdown: [
    { condition: "New", count: 295 },
    { condition: "Good", count: 238 },
  ],
  status_breakdown: [
    { status: "available", count: 540 },
    { status: "on_loan", count: 108 },
  ],
  top_borrowers: [
    { id: "b1", name: "Mart", total_loans: 46, active_loans: 4 },
    { id: "b2", name: "Kati", total_loans: 36, active_loans: 2 },
  ],
};

const MONTHLY: MonthlyLoanActivity[] = [
  { month: "2026-01-01", loans_created: 18, loans_returned: 14 },
  { month: "2026-02-01", loans_created: 24, loans_returned: 19 },
];

const OUT_OF_STOCK: OutOfStockItem[] = [
  {
    id: "it-99",
    name: "M8 hex bolts",
    sku: "BOLT-M8",
    min_stock_level: 50,
    category_name: "Fasteners",
  },
];

// Tracks whether ANY analytics request fired — the no-workspace guard must fire
// zero requests (T-13b-08).
let requestCount = 0;

function mountHandlers(opts?: {
  summary?: AnalyticsSummary;
  monthly?: MonthlyLoanActivity[];
  outOfStock?: OutOfStockItem[];
}) {
  server.use(
    http.get("/api/workspaces/:wsId/analytics/summary", () => {
      requestCount += 1;
      return HttpResponse.json(opts?.summary ?? SUMMARY);
    }),
    http.get("/api/workspaces/:wsId/analytics/loans/monthly", () => {
      requestCount += 1;
      return HttpResponse.json(opts?.monthly ?? MONTHLY);
    }),
    http.get("/api/workspaces/:wsId/analytics/out-of-stock", () => {
      requestCount += 1;
      return HttpResponse.json(opts?.outOfStock ?? OUT_OF_STOCK);
    }),
  );
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/analytics"]}>
          <AnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nProvider>,
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  requestCount = 0;
});

describe("AnalyticsPage (W2 composition)", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders the six chart Windows over the summary + monthly queries", async () => {
    setContext();
    mountHandlers();
    renderPage();

    // ANL-01: category, location, condition, status.
    expect(
      await screen.findByRole("heading", { name: /category breakdown/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /location value/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /condition/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /status mix/i }),
    ).toBeInTheDocument();
    // ANL-02: top-borrowers + monthly.
    expect(
      screen.getByRole("heading", { name: /top borrowers/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /monthly loan activity/i }),
    ).toBeInTheDocument();
  });

  it("renders the out-of-stock table with rows linking to /items/{id}", async () => {
    setContext();
    mountHandlers();
    renderPage();

    // ANL-04: the out-of-stock surface + a back-reference link.
    const link = await screen.findByRole("link", { name: "M8 hex bolts" });
    expect(link).toHaveAttribute("href", "/items/it-99");
  });

  it("renders the workspace empty-state and fires NO analytics request when there is no workspace", async () => {
    setContext({ currentWorkspaceId: null, workspaces: [] });
    mountHandlers();
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /no workspace/i }),
    ).toBeInTheDocument();
    // The empty-state main is the ONLY thing rendered — no chart query fired.
    expect(
      screen.queryByRole("heading", { name: /category breakdown/i }),
    ).not.toBeInTheDocument();
    // Give any (incorrectly) enabled query a tick to fire, then assert none did.
    await waitFor(() => {
      expect(requestCount).toBe(0);
    });
  });

  it("degrades gracefully on empty summary + empty out-of-stock (no white-screen)", async () => {
    setContext();
    const EMPTY_SUMMARY: AnalyticsSummary = {
      dashboard: null,
      loan_stats: null,
      category_stats: [],
      location_values: [],
      condition_breakdown: [],
      status_breakdown: [],
      top_borrowers: [],
    };
    mountHandlers({ summary: EMPTY_SUMMARY, monthly: [], outOfStock: [] });
    renderPage();

    // The page still mounts: every chart renders its own empty state, the table
    // its own. The monthly chart's title still appears (its empty state keeps
    // the Window), and the out-of-stock empty-state heading shows — no throw
    // from formatCents on an empty value series (the 10b money landmine).
    expect(
      await screen.findByRole("heading", { name: /monthly loan activity/i }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: /nothing out of stock/i }),
    ).toBeInTheDocument();
    // At least one chart shows its "No data" empty state.
    await waitFor(() => {
      expect(
        screen.getAllByRole("heading", { name: /no data/i }).length,
      ).toBeGreaterThan(0);
    });
  });
});
