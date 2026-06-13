import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { useAnalyticsSummary } from "./useAnalyticsSummary";
import { useMonthlyLoanActivity } from "./useMonthlyLoanActivity";
import { useOutOfStock } from "./useOutOfStock";

// Phase 13b Plan 01 Task 2 — analytics query-hook tests. wsId is sourced from
// useWorkspace() — mock it so the hooks run under a deterministic workspace id
// (and a null one to assert the enabled-gate). MSW serves the bare-body
// /analytics/* endpoints; the hooks render under a QueryClientProvider.

const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

const SUMMARY = {
  dashboard: {},
  loan_stats: {},
  category_stats: [
    { id: "c1", name: "Tools", item_count: 4, inventory_count: 9, total_value: 12345 },
  ],
  location_values: [],
  recent_activity: [],
  condition_breakdown: [{ condition: "good", count: 7 }],
  status_breakdown: [{ status: "available", count: 3 }],
  top_borrowers: [],
};

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useAnalyticsSummary", () => {
  it("fetches /analytics/summary and exposes the data when a workspace is selected", async () => {
    setWsId("ws-A");
    let hit = false;
    server.use(
      http.get("/api/workspaces/:wsId/analytics/summary", () => {
        hit = true;
        return HttpResponse.json(SUMMARY);
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper });

    await waitFor(() => expect(result.current.data).toBeTruthy());
    expect(hit).toBe(true);
    expect(result.current.data!.category_stats[0].id).toBe("c1");
    expect(result.current.data!.condition_breakdown[0].condition).toBe("good");
  });

  it("is disabled without a workspace id (no request fires)", () => {
    setWsId(null);
    let hit = false;
    server.use(
      http.get("/api/workspaces/:wsId/analytics/summary", () => {
        hit = true;
        return HttpResponse.json(SUMMARY);
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(hit).toBe(false);
  });

  it("keys exactly under ['analytics', wsId, 'summary', 12]", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:wsId/analytics/summary", () =>
        HttpResponse.json(SUMMARY),
      ),
    );
    const { client, wrapper } = makeWrapper();
    const { result } = renderHook(() => useAnalyticsSummary(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeTruthy());

    const key = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .find((k) => Array.isArray(k) && k[0] === "analytics");
    expect(key).toEqual(["analytics", "ws-A", "summary", 12]);
  });
});

describe("useMonthlyLoanActivity", () => {
  it("fetches /analytics/loans/monthly?months=12 and exposes the series", async () => {
    setWsId("ws-A");
    let monthsParam: string | null = null;
    server.use(
      http.get(
        "/api/workspaces/:wsId/analytics/loans/monthly",
        ({ request }) => {
          monthsParam = new URL(request.url).searchParams.get("months");
          return HttpResponse.json([
            { month: "2026-01", loans_created: 3, loans_returned: 2 },
          ]);
        },
      ),
    );
    const { client, wrapper } = makeWrapper();
    const { result } = renderHook(() => useMonthlyLoanActivity(), { wrapper });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(monthsParam).toBe("12");
    expect(result.current.items[0].loans_created).toBe(3);

    const key = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .find((k) => Array.isArray(k) && k[0] === "analytics");
    expect(key).toEqual(["analytics", "ws-A", "monthly", 12]);
  });

  it("defaults items to [] and is disabled without a workspace", () => {
    setWsId(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMonthlyLoanActivity(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});

describe("useOutOfStock", () => {
  it("fetches /analytics/out-of-stock and exposes the rows", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:wsId/analytics/out-of-stock", () =>
        HttpResponse.json([
          { id: "i1", name: "Drill", sku: "SKU-1", min_stock_level: 2 },
        ]),
      ),
    );
    const { client, wrapper } = makeWrapper();
    const { result } = renderHook(() => useOutOfStock(), { wrapper });

    await waitFor(() => expect(result.current.items.length).toBeGreaterThan(0));
    expect(result.current.items[0].name).toBe("Drill");

    const key = client
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .find((k) => Array.isArray(k) && k[0] === "analytics");
    expect(key).toEqual(["analytics", "ws-A", "out-of-stock"]);
  });

  it("defaults items to [] and is disabled without a workspace", () => {
    setWsId(null);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOutOfStock(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });
});
