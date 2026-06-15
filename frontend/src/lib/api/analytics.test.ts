import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { analyticsApi } from "./analytics";

// Phase 13b Plan 01 Task 1 — analyticsApi unit tests. ALL three endpoints are
// Huma BARE-BODY: the parsed JSON IS the object/array — assert NO { items }
// unwrap happens. Stubs global.fetch to pin the exact URL each call hits.

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SUMMARY = {
  dashboard: {},
  loan_stats: {},
  category_stats: [
    {
      id: "c1",
      name: "Tools",
      item_count: 4,
      inventory_count: 9,
      total_value: 12345,
    },
  ],
  location_values: [
    {
      id: "l1",
      name: "Garage",
      item_count: 2,
      total_quantity: 5,
      total_value: 6789,
    },
  ],
  recent_activity: [],
  condition_breakdown: [{ condition: "good", count: 7 }],
  status_breakdown: [{ status: "available", count: 3 }],
  top_borrowers: [
    {
      id: "b1",
      name: "Alice",
      email: "a@x.io",
      total_loans: 5,
      active_loans: 1,
    },
  ],
};

describe("analyticsApi.summary (bare-body object)", () => {
  it("hits /workspaces/{ws}/analytics/summary and returns the bare object verbatim", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUMMARY));

    const res = await analyticsApi.summary("ws-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/analytics/summary");
    // the four+1 summary sub-arrays come back verbatim (NOT under { items })
    expect(res.category_stats[0].id).toBe("c1");
    expect(res.location_values[0].name).toBe("Garage");
    expect(res.condition_breakdown[0].condition).toBe("good");
    expect(res.status_breakdown[0].status).toBe("available");
    expect(res.top_borrowers[0].name).toBe("Alice");
  });

  it("does NOT append ?months (summary ignores it)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SUMMARY));
    await analyticsApi.summary("ws-1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("months");
  });
});

describe("analyticsApi.monthlyActivity (bare-body array, dedicated endpoint)", () => {
  it("hits /analytics/loans/monthly?months=12 by default and returns a bare array", async () => {
    const series = [{ month: "2026-01", loans_created: 3, loans_returned: 2 }];
    fetchMock.mockResolvedValueOnce(jsonResponse(series));

    const res = await analyticsApi.monthlyActivity("ws-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/analytics/loans/monthly");
    expect(url).toContain("months=12");
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].loans_created).toBe(3);
  });

  it("forwards an explicit positive months", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await analyticsApi.monthlyActivity("ws-1", 6);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("months=6");
  });

  it("clamps NaN / ≤0 / fractional months to a sane positive int", async () => {
    // fresh Response per call — a Response body can only be consumed once
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse([])));

    await analyticsApi.monthlyActivity("ws-1", Number.NaN);
    expect(fetchMock.mock.calls[0][0]).toContain("months=12");

    await analyticsApi.monthlyActivity("ws-1", 0);
    expect(fetchMock.mock.calls[1][0]).toContain("months=12");

    await analyticsApi.monthlyActivity("ws-1", -5);
    expect(fetchMock.mock.calls[2][0]).toContain("months=12");

    await analyticsApi.monthlyActivity("ws-1", 7.9);
    expect(fetchMock.mock.calls[3][0]).toContain("months=7");
  });
});

describe("analyticsApi.outOfStock (bare-body array)", () => {
  it("hits /analytics/out-of-stock and returns a bare ARRAY (not { items })", async () => {
    const rows = [
      {
        id: "i1",
        name: "Drill",
        sku: "SKU-1",
        min_stock_level: 2,
        category_name: "Tools",
      },
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(rows));

    const res = await analyticsApi.outOfStock("ws-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/analytics/out-of-stock");
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].name).toBe("Drill");
  });

  it("returns the empty array verbatim", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const res = await analyticsApi.outOfStock("ws-1");
    expect(res).toEqual([]);
  });
});
