import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { movementsApi } from "./movements";

// Phase 7b Plan 01 Task 2 — movementsApi unit tests. The movement reads return
// a BARE { items } (NO pagination envelope, ever — Pitfall 1 / RESEARCH endpoint
// table rows 16-18); each method must unwrap to a Movement[]. Stubs global.fetch
// to assert the exact URL each of the three scopes hits.

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

const MOVEMENT = {
  id: "mv-1",
  workspace_id: "ws-1",
  inventory_id: "inv-1",
  to_location_id: "loc-2",
  quantity: 3,
  created_at: "2026-06-13T00:00:00Z",
};

describe("movementsApi.workspace (bare {items})", () => {
  it("hits /workspaces/{wsId}/movements and unwraps to Movement[]", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [MOVEMENT] }));

    const res = await movementsApi.workspace("ws-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/movements");
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].id).toBe("mv-1");
  });

  it("returns [] for the empty default (empty-state — Pitfall 3)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    const res = await movementsApi.workspace("ws-1");
    expect(res).toEqual([]);
  });

  it("forwards page/limit when supplied", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    await movementsApi.workspace("ws-1", { page: 2, limit: 10 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
  });
});

describe("movementsApi.byInventory", () => {
  it("hits /inventory/{invId}/movements and unwraps to Movement[]", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [MOVEMENT] }));
    const res = await movementsApi.byInventory("ws-1", "inv-1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/inventory/inv-1/movements");
    expect(res).toHaveLength(1);
  });
});

describe("movementsApi.byLocation", () => {
  it("hits /locations/{locId}/movements and unwraps to Movement[]", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    const res = await movementsApi.byLocation("ws-1", "loc-1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/locations/loc-1/movements");
    expect(res).toEqual([]);
  });
});
