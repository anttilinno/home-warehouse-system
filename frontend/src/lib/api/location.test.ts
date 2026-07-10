import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locationApi } from "./location";

// Phase 4 Plan 01 (test-gaps 4.1) — locationApi unit tests. Stubs global.fetch
// (the Phase 65 canonical fetch-mock pattern, mirroring items.test.ts) to
// assert the per-endpoint envelope split (Pitfall 2: list is PAGINATED,
// search is a BARE {items} unwrapped to an array) plus the limit-clamp-to-100
// guard (Pitfall 3).

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

const LOCATION = {
  id: "loc-1",
  workspace_id: "ws-1",
  name: "Garage",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("locationApi.list (paginated envelope)", () => {
  it("builds /workspaces/{ws}/locations?page=&limit= and returns the envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [LOCATION], total: 1, page: 2, total_pages: 1 }),
    );

    const res = await locationApi.list("ws-1", 2, 50);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/locations?page=2&limit=50");
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
  });

  it("clamps limit to 100 (Pitfall 3)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );
    await locationApi.list("ws-1", 1, 500);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
  });

  it("defaults to page=1&limit=100 when omitted", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );
    await locationApi.list("ws-1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("page=1&limit=100");
  });
});

describe("locationApi.search (bare {items} — Pitfall 2)", () => {
  it("hits /locations/search?q=&limit= and unwraps to Location[]", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [LOCATION] }));

    const res = await locationApi.search("ws-1", "gar age", 25);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(
      "/workspaces/ws-1/locations/search?q=gar%20age&limit=25",
    );
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].id).toBe("loc-1");
  });

  it("clamps search limit to 100 (Pitfall 3)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    await locationApi.search("ws-1", "x", 999);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
  });
});

describe("locationApi CRUD + lifecycle", () => {
  it("get fetches /locations/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOCATION));
    await locationApi.get("ws-1", "loc-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/locations/loc-1",
    );
  });

  it("create POSTs /locations with the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOCATION));
    await locationApi.create("ws-1", { name: "Garage" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/locations");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: "Garage" }));
  });

  it("update PATCHes /locations/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LOCATION));
    await locationApi.update("ws-1", "loc-1", { description: "" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/locations/loc-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ description: "" }),
    );
  });

  it("archive/restore POST and del DELETEs", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204));

    await locationApi.archive("ws-1", "loc-1");
    await locationApi.restore("ws-1", "loc-1");
    await locationApi.del("ws-1", "loc-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/locations/loc-1/archive");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toContain("/locations/loc-1/restore");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[2][0]).toContain("/locations/loc-1");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
  });
});
