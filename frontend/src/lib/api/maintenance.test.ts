import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { maintenanceApi } from "./maintenance";

// Phase 4 Plan 01 (test-gaps 4.1) — maintenanceApi unit tests. Stubs
// global.fetch (the Phase 65 canonical fetch-mock pattern, mirroring
// items.test.ts) to assert URL/payload shape and the envelope split: the
// top-level list PAGINATES { items, total }; byInventory/due return a BARE
// { items }.

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

const SCHEDULE = {
  id: "sched-1",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  title: "Oil change",
  interval_days: 90,
  next_due: "2026-09-01",
};
const DUE_SCHEDULE = { ...SCHEDULE, is_overdue: true };

describe("maintenanceApi.list (paginated envelope)", () => {
  it("builds /maintenance?page=&limit= and returns the envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [SCHEDULE], total: 1 }),
    );
    const res = await maintenanceApi.list("ws-1", { page: 2, limit: 50 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/maintenance?page=2&limit=50");
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
  });

  it("clamps limit to 100 and defaults page=1&limit=50", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));
    await maintenanceApi.list("ws-1", { limit: 500 });
    expect(fetchMock.mock.calls[0][0] as string).toContain("page=1&limit=100");
  });

  it("defaults page=1&limit=50 when opts omitted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));
    await maintenanceApi.list("ws-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain("page=1&limit=50");
  });
});

describe("maintenanceApi scoped reads (bare {items})", () => {
  it("byInventory hits /inventory/{id}/maintenance", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [SCHEDULE] }));
    await maintenanceApi.byInventory("ws-1", "inv-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/inventory/inv-1/maintenance",
    );
  });

  it("due hits /maintenance/due with no query when days omitted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [DUE_SCHEDULE] }));
    await maintenanceApi.due("ws-1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/maintenance/due");
    expect(url).not.toContain("?days=");
  });

  it("due hits /maintenance/due?days= when provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    await maintenanceApi.due("ws-1", 7);
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/maintenance/due?days=7",
    );
  });
});

describe("maintenanceApi CRUD + lifecycle", () => {
  it("get fetches /maintenance/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SCHEDULE));
    await maintenanceApi.get("ws-1", "sched-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/maintenance/sched-1",
    );
  });

  it("create POSTs /maintenance with the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SCHEDULE));
    await maintenanceApi.create("ws-1", {
      inventory_id: "inv-1",
      title: "Oil change",
      interval_days: 90,
      next_due: "2026-09-01",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/maintenance");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({
        inventory_id: "inv-1",
        title: "Oil change",
        interval_days: 90,
        next_due: "2026-09-01",
      }),
    );
  });

  it("update PATCHes /maintenance/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SCHEDULE));
    await maintenanceApi.update("ws-1", "sched-1", { title: "New title" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/maintenance/sched-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ title: "New title" }),
    );
  });

  it("complete POSTs /maintenance/{id}/complete with notes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SCHEDULE));
    await maintenanceApi.complete("ws-1", "sched-1", "done");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/maintenance/sched-1/complete");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ notes: "done" }));
  });

  it("del DELETEs /maintenance/{id}", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await maintenanceApi.del("ws-1", "sched-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/maintenance/sched-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
