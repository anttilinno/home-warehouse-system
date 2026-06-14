import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { borrowersApi } from "./borrowers";

// Phase 9 Plan 01 Task 1 — borrowersApi unit tests. We stub `global.fetch`
// directly (the canonical fetch-mock pattern from items.test.ts) so we can
// assert the EXACT URL shape + verb each method builds. The defining contract:
// list/search return the BARE { items } envelope — NO total (Pitfall 1). The
// list/search default limit is 100 and never exceeds it (Pitfall 2 — 422 cap).

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

const BORROWER = {
  id: "bor-1",
  workspace_id: "ws-1",
  name: "Alex",
  email: "alex@example.io",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("borrowersApi.list", () => {
  it("GETs /workspaces/{ws}/borrowers with page=1 & limit=100 by default", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [BORROWER] }));

    await borrowersApi.list("ws-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/borrowers?page=1&limit=100");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("returns the BARE { items } envelope (no total)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [BORROWER] }));

    const res = await borrowersApi.list("ws-1");

    expect(res).toEqual({ items: [BORROWER] });
    // Reading .total is a TYPE error; assert it is also absent at runtime.
    expect((res as Record<string, unknown>).total).toBeUndefined();
  });

  it("never requests a limit above 100 (422-cap clamp — Pitfall 2)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await borrowersApi.list("ws-1", 1, 500);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
    expect(url).not.toContain("limit=500");
  });

  it("forwards an explicit page & a within-cap limit", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await borrowersApi.list("ws-1", 3, 50);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("page=3");
    expect(url).toContain("limit=50");
  });
});

describe("borrowersApi.search", () => {
  it("GETs /borrowers/search?q={encoded}&limit=100 and returns r.items", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [BORROWER] }));

    const result = await borrowersApi.search("ws-1", "a@x io");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/borrowers/search?q=a%40x%20io");
    expect(url).toContain("limit=100");
    expect(result).toEqual([BORROWER]);
  });

  it("clamps the search limit to 100", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

    await borrowersApi.search("ws-1", "x", 999);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=100");
    expect(url).not.toContain("limit=999");
  });
});

describe("borrowersApi CRUD", () => {
  it("get GETs /borrowers/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BORROWER));

    const b = await borrowersApi.get("ws-1", "bor-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/borrowers/bor-1");
    expect((init as RequestInit).method).toBe("GET");
    expect(b).toMatchObject({ id: "bor-1", name: "Alex" });
  });

  it("create POSTs to /borrowers with the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BORROWER));

    await borrowersApi.create("ws-1", { name: "Alex", email: "alex@example.io" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/borrowers");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ name: "Alex", email: "alex@example.io" }),
    );
  });

  it("update PATCHes /borrowers/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(BORROWER));

    await borrowersApi.update("ws-1", "bor-1", { name: "Alexa" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/borrowers/bor-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: "Alexa" }));
  });

  it("del DELETEs /borrowers/{id}", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    await borrowersApi.del("ws-1", "bor-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/borrowers/bor-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
