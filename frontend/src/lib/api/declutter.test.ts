import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { declutterApi } from "./declutter";

// Phase 14 Plan 04 Task 1 — declutterApi unit tests. We stub `global.fetch`
// directly (the canonical fetch-mock pattern from items.test.ts / borrowers.test.ts)
// so we can assert the EXACT URL shape + verb. The defining contract:
//   * list returns the BARE { items, total } envelope — the rows live under
//     `items` (handler.go:159), NOT `changes` (DECL-01 truth).
//   * markUsed POSTs /inventory/{inventory_id}/mark-used — the path param is the
//     INVENTORY row id (the DeclutterItem.id field), never item_id (T-14-13).

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

const ROW = {
  id: "inv-1",
  item_id: "it-1",
  item_name: "Cordless Drill",
  item_sku: "SKU-1",
  location_id: "loc-1",
  location_name: "Garage",
  category_id: "cat-1",
  category_name: "Tools",
  quantity: 1,
  days_unused: 200,
  score: 88,
};

describe("declutterApi.list", () => {
  it("requests threshold_days + group_by and resolves the BARE { items, total } envelope", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [ROW], total: 1 }));

    const res = await declutterApi.list("ws-1", {
      thresholdDays: 180,
      groupBy: "category",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/declutter");
    expect(url).toContain("threshold_days=180");
    expect(url).toContain("group_by=category");
    expect((init as RequestInit).method).toBe("GET");

    // The rows live under `items`, NOT `changes` (DECL-01 truth).
    expect(res.items).toEqual([ROW]);
    expect(res.total).toBe(1);
    expect((res as unknown as Record<string, unknown>).changes).toBeUndefined();
  });

  it("sends no surprise params when called without opts", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));

    await declutterApi.list("ws-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/declutter");
    expect(url).not.toContain("threshold_days=");
    expect(url).not.toContain("group_by=");
    expect(url).not.toContain("undefined");
  });

  it("maps thresholdDays→threshold_days, groupBy→group_by, page & limit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));

    await declutterApi.list("ws-1", {
      thresholdDays: 365,
      groupBy: "location",
      page: 2,
      limit: 25,
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("threshold_days=365");
    expect(url).toContain("group_by=location");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=25");
  });
});

describe("declutterApi.counts", () => {
  it("GETs /declutter/counts", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        unused_90: 3,
        unused_180: 2,
        unused_365: 1,
        value_90: 1000,
        value_180: 500,
        value_365: 250,
      }),
    );

    const counts = await declutterApi.counts("ws-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/declutter/counts");
    expect((init as RequestInit).method).toBe("GET");
    expect(counts.unused_90).toBe(3);
    expect(counts.value_90).toBe(1000);
  });
});

describe("declutterApi.markUsed", () => {
  it("POSTs /inventory/{inventoryId}/mark-used with the INVENTORY row id", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: true, message: "ok" }),
    );

    const res = await declutterApi.markUsed("ws-1", "inv-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/inventory/inv-1/mark-used");
    expect(url).not.toContain("it-1"); // never the item_id (T-14-13)
    expect((init as RequestInit).method).toBe("POST");
    expect(res).toEqual({ success: true, message: "ok" });
  });
});
