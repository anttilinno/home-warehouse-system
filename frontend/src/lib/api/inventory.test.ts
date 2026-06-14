import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inventoryApi } from "./inventory";

// Phase 7b Plan 01 Task 2 — inventoryApi unit tests. Stubs global.fetch (the
// Phase 65 canonical fetch-mock pattern, mirroring items.test.ts) to assert the
// EXACT URL shape each method builds and that the scoped reads unwrap a BARE
// { items } (Pitfall 1) — never a paginated envelope. Also guards: move body
// carries NO quantity (Pitfall 2) and quantity allows 0 (Pitfall 5).

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const INV = {
  id: "inv-1",
  workspace_id: "ws-1",
  item_id: "it-1",
  location_id: "loc-1",
  quantity: 3,
  condition: "GOOD",
  status: "AVAILABLE",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("inventoryApi.list (full envelope)", () => {
  it("builds /workspaces/{wsId}/inventory?page=&limit= and returns the envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [INV], total: 1, page: 2, total_pages: 1 }),
    );

    const res = await inventoryApi.list("ws-1", { page: 2, limit: 25 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/inventory?");
    expect(url).toContain("page=2");
    expect(url).toContain("limit=25");
    expect(res.total).toBe(1);
    expect(res.page).toBe(2);
    expect(res.total_pages).toBe(1);
    expect(res.items).toHaveLength(1);
  });

  it("omits empty/undefined params (no trailing ? when none set)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );
    await inventoryApi.list("ws-1", {});
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/inventory");
    expect(url).not.toContain("?");
  });
});

describe("inventoryApi.byItem (bare {items} — Pitfall 1)", () => {
  it("hits /inventory/by-item/{itemId} and returns Inventory[] (unwrapped)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [INV] }));

    const res = await inventoryApi.byItem("ws-1", "it-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/inventory/by-item/it-1");
    expect(Array.isArray(res)).toBe(true);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("inv-1");
  });
});

describe("inventoryApi.expiring", () => {
  it("hits /inventory/expiring?days= and returns {items,total}", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            inventory_id: "inv-1",
            item_id: "it-1",
            item_name: "Drill",
            quantity: 1,
            kind: "expiration",
            date: "2026-07-01",
          },
        ],
        total: 1,
      }),
    );

    const res = await inventoryApi.expiring("ws-1", 14);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/inventory/expiring?days=14");
    expect(res.total).toBe(1);
    expect(res.items[0].kind).toBe("expiration");
  });

  it("defaults days=30 when omitted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));
    await inventoryApi.expiring("ws-1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("days=30");
  });
});

describe("inventoryApi mutations", () => {
  it("create POSTs /inventory", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(INV));
    await inventoryApi.create("ws-1", { item_id: "it-1", quantity: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/inventory");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("update PATCHes /inventory/{id} (condition rides here)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(INV));
    await inventoryApi.update("ws-1", "inv-1", {
      location_id: "loc-1",
      quantity: 3,
      condition: "FAIR",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/inventory/inv-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).not.toContain("status");
  });

  it("updateQuantity PATCHes /inventory/{id}/quantity with {quantity} (allows 0 — Pitfall 5)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...INV, quantity: 0 }));
    await inventoryApi.updateQuantity("ws-1", "inv-1", 0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/inventory/inv-1/quantity");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ quantity: 0 }));
  });

  it("updateStatus PATCHes /inventory/{id}/status with {status}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...INV, status: "IN_USE" }));
    await inventoryApi.updateStatus("ws-1", "inv-1", "IN_USE");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/inventory/inv-1/status");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ status: "IN_USE" }),
    );
  });

  it("move POSTs /inventory/{id}/move with {location_id, container_id} ONLY — NO quantity (Pitfall 2)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(INV));
    await inventoryApi.move("ws-1", "inv-1", "loc-2", "cont-9");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/inventory/inv-1/move");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({ location_id: "loc-2", container_id: "cont-9" });
    expect(body.quantity).toBeUndefined();
  });

  it("move without a container sends container_id undefined (no quantity ever)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(INV));
    await inventoryApi.move("ws-1", "inv-1", "loc-2");
    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.location_id).toBe("loc-2");
    expect("quantity" in body).toBe(false);
  });

  it("archive/restore POST and return void", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204));
    await inventoryApi.archive("ws-1", "inv-1");
    await inventoryApi.restore("ws-1", "inv-1");
    expect(fetchMock.mock.calls[0][0]).toContain("/inventory/inv-1/archive");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toContain("/inventory/inv-1/restore");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
  });
});
