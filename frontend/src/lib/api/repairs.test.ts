import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repairsApi } from "./repairs";

// Phase 4 Plan 01 (test-gaps 4.1) — repairsApi unit tests. Stubs global.fetch
// (canonical fetch-mock pattern, mirroring loans.test.ts) to assert URL/payload
// shape for the full lifecycle, and that cost stays an int (cents).

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

const REPAIR = {
  id: "rep-1",
  inventory_id: "inv-1",
  description: "broken screen",
  status: "PENDING",
};

describe("repairsApi.byInventory", () => {
  it("fetches /inventory/{id}/repairs", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [REPAIR], total: 1 }),
    );
    await repairsApi.byInventory("ws-1", "inv-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/inventory/inv-1/repairs",
    );
  });
});

describe("repairsApi.cost", () => {
  it("fetches BARE {items} at /inventory/{id}/repair-cost", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [{ currency_code: "USD", total_cents: 500 }] }),
    );
    await repairsApi.cost("ws-1", "inv-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/inventory/inv-1/repair-cost",
    );
  });
});

describe("repairsApi lifecycle", () => {
  it("get fetches /repairs/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(REPAIR));
    await repairsApi.get("ws-1", "rep-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/repairs/rep-1",
    );
  });

  it("create POSTs /repairs with cost as an int (cents)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(REPAIR));
    await repairsApi.create("ws-1", {
      inventory_id: "inv-1",
      description: "broken screen",
      cost: 1999,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({
        inventory_id: "inv-1",
        description: "broken screen",
        cost: 1999,
      }),
    );
  });

  it("update PATCHes /repairs/{id} without status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(REPAIR));
    await repairsApi.update("ws-1", "rep-1", { notes: "ordered part" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ notes: "ordered part" }),
    );
    expect((init as RequestInit).body).not.toContain("status");
  });

  it("start POSTs /repairs/{id}/start", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(REPAIR));
    await repairsApi.start("ws-1", "rep-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1/start");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("complete POSTs /repairs/{id}/complete with {new_condition}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(REPAIR));
    await repairsApi.complete("ws-1", "rep-1", "GOOD");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1/complete");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ new_condition: "GOOD" }),
    );
  });

  it("del DELETEs /repairs/{id}", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await repairsApi.del("ws-1", "rep-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
