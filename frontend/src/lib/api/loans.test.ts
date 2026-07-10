import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loansApi } from "./loans";

// Phase 4 Plan 01 (test-gaps 4.1) — loansApi unit tests. Stubs global.fetch
// (the Phase 65 canonical fetch-mock pattern, mirroring items.test.ts) to
// assert URL/payload shape, the byItem is_active partitioning, and the
// per-endpoint BARE-{items}-vs-decorated-entity envelope split.

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

const LOAN_ACTIVE = {
  id: "loan-1",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  borrower_id: "b-1",
  quantity: 1,
  is_active: true,
  loaned_at: "2026-06-13T00:00:00Z",
};
const LOAN_HISTORY = { ...LOAN_ACTIVE, id: "loan-2", is_active: false };

describe("loansApi.byItem (partitions on is_active)", () => {
  it("hits /items/{id}/loans and splits active vs history", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [LOAN_ACTIVE, LOAN_HISTORY] }),
    );

    const res = await loansApi.byItem("ws-1", "it-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/items/it-1/loans");
    expect(res.active).toHaveLength(1);
    expect(res.active[0].id).toBe("loan-1");
    expect(res.history).toHaveLength(1);
    expect(res.history[0].id).toBe("loan-2");
  });
});

describe("loansApi lists (bare {items})", () => {
  it("list builds /loans?page=&limit=", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [LOAN_ACTIVE] }));
    await loansApi.list("ws-1", 2, 25);
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/loans?page=2&limit=25",
    );
  });

  it("active hits /loans/active", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [LOAN_ACTIVE] }));
    await loansApi.active("ws-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/loans/active",
    );
  });

  it("overdue hits /loans/overdue", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    await loansApi.overdue("ws-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/loans/overdue",
    );
  });

  it("byBorrower hits /borrowers/{id}/loans", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    await loansApi.byBorrower("ws-1", "b-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/borrowers/b-1/loans",
    );
  });
});

describe("loansApi lifecycle", () => {
  it("get fetches /loans/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOAN_ACTIVE));
    await loansApi.get("ws-1", "loan-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/loans/loan-1",
    );
  });

  it("create POSTs /loans with inventory_id (Pitfall 1: not item_id)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOAN_ACTIVE));
    await loansApi.create("ws-1", {
      inventory_id: "inv-1",
      borrower_id: "b-1",
      quantity: 1,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/loans");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ inventory_id: "inv-1", borrower_id: "b-1", quantity: 1 }),
    );
  });

  it("return POSTs /loans/{id}/return", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOAN_HISTORY));
    await loansApi.return("ws-1", "loan-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/loans/loan-1/return");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("update PATCHes /loans/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOAN_ACTIVE));
    await loansApi.update("ws-1", "loan-1", { notes: "careful" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/loans/loan-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ notes: "careful" }));
  });

  it("extend PATCHes /loans/{id}/extend with new_due_date", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOAN_ACTIVE));
    await loansApi.extend("ws-1", "loan-1", "2026-07-01");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/loans/loan-1/extend");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ new_due_date: "2026-07-01" }),
    );
  });
});
