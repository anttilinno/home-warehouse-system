import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { wishlistApi } from "./wishlist";

// Phase 14 Plan 03 Task 1 — wishlistApi unit tests. We stub `global.fetch`
// directly (the canonical fetch-mock pattern from borrowers.test.ts / items.test.ts)
// so we can assert the EXACT URL shape + verb each method builds. The defining
// contract: the LIST envelope is `{ items, total }` (key `items`, NOT changes);
// `?status=` is appended only when a status is supplied.

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

const WISH = {
  id: "w-1",
  name: "Cordless Drill",
  priority: 3,
  status: "wanted" as const,
  price_estimate: 4999,
  currency_code: "EUR",
  created_at: "2026-06-13T00:00:00Z",
};

describe("wishlistApi.list", () => {
  it("GETs /workspaces/{ws}/wishlist?status=wanted and resolves bare { items, total }", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [WISH], total: 1 }));

    const res = await wishlistApi.list("ws-1", "wanted");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/wishlist?status=wanted");
    // `items` is the row array (NOT changes).
    expect(res.items).toEqual([WISH]);
    expect(res.total).toBe(1);
    expect((res as unknown as Record<string, unknown>).changes).toBeUndefined();
  });

  it("GETs /workspaces/{ws}/wishlist with NO ?status when status is omitted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [], total: 0 }));

    await wishlistApi.list("ws-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/wishlist");
    expect(url).not.toContain("?status");
  });
});

describe("wishlistApi CRUD", () => {
  it("create POSTs /workspaces/{ws}/wishlist with the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(WISH));

    await wishlistApi.create("ws-1", { name: "Cordless Drill" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/wishlist");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ name: "Cordless Drill" }),
    );
  });

  it("update PATCHes /workspaces/{ws}/wishlist/{id} with { status }", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ...WISH, status: "ordered" }));

    await wishlistApi.update("ws-1", "w-1", { status: "ordered" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/wishlist/w-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ status: "ordered" }),
    );
  });

  it("remove DELETEs /workspaces/{ws}/wishlist/{id}", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));

    await wishlistApi.remove("ws-1", "w-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/wishlist/w-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
