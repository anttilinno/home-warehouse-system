import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { containerApi } from "./container";

// Phase 10 Plan 01 — containerApi unit tests. Stubs global.fetch (the Phase 65
// canonical fetch-mock pattern, mirroring items.test.ts) to assert the exact URL
// shape each method builds and the per-endpoint envelope split (Pitfall 2: list
// is PAGINATED, search is a BARE {items} unwrapped to an array) plus the
// limit-clamp-to-100 guard (Pitfall 3).

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

const CONTAINER = {
  id: "cont-1",
  workspace_id: "ws-1",
  name: "Bin A",
  location_id: "loc-1",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("containerApi.list (paginated envelope)", () => {
  it("builds /workspaces/{ws}/containers?page=&limit= and returns the envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [CONTAINER], total: 1, page: 2, total_pages: 1 }),
    );

    const res = await containerApi.list("ws-1", 2, 50);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/containers?page=2&limit=50");
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
  });

  it("clamps limit to 100 (Pitfall 3)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );
    await containerApi.list("ws-1", 1, 500);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
  });

  it("defaults to page=1&limit=100 when omitted", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );
    await containerApi.list("ws-1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("page=1&limit=100");
  });
});

describe("containerApi.search (bare {items} — Pitfall 2)", () => {
  it("hits /containers/search?q=&limit= and unwraps to Container[]", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [CONTAINER] }));

    const res = await containerApi.search("ws-1", "bin a", 25);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(
      "/workspaces/ws-1/containers/search?q=bin%20a&limit=25",
    );
    expect(Array.isArray(res)).toBe(true);
    expect(res[0].id).toBe("cont-1");
  });

  it("clamps search limit to 100 (Pitfall 3)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));
    await containerApi.search("ws-1", "x", 999);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
  });
});

describe("containerApi CRUD + lifecycle", () => {
  it("get fetches /containers/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CONTAINER));
    await containerApi.get("ws-1", "cont-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/containers/cont-1",
    );
  });

  it("create POSTs /containers with the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CONTAINER));
    await containerApi.create("ws-1", { name: "Bin A", location_id: "loc-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/containers");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ name: "Bin A", location_id: "loc-1" }),
    );
  });

  it("update PATCHes /containers/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CONTAINER));
    await containerApi.update("ws-1", "cont-1", { description: "" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/containers/cont-1");
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

    await containerApi.archive("ws-1", "cont-1");
    await containerApi.restore("ws-1", "cont-1");
    await containerApi.del("ws-1", "cont-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/containers/cont-1/archive");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toContain("/containers/cont-1/restore");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[2][0]).toContain("/containers/cont-1");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
  });
});
