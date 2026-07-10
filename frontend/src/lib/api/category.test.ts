import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { categoryApi } from "./category";

// Phase 10 Plan 01 (TAX-02/07) — categoryApi unit tests. Stubs global.fetch (the
// Phase 65 canonical fetch-mock pattern, mirroring items.test.ts) to assert the
// exact URL shape each method builds and that list returns a BARE { items }
// envelope (Pitfall 2: no `.total` on a category list).

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

const CATEGORY = {
  id: "cat-1",
  workspace_id: "ws-1",
  name: "Tools",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("categoryApi.list (bare {items} — Pitfall 2)", () => {
  it("hits /workspaces/{ws}/categories and returns items without total", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [CATEGORY] }));

    const res = await categoryApi.list("ws-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/categories");
    expect(res.items).toHaveLength(1);
    expect((res as { total?: number }).total).toBeUndefined();
  });
});

describe("categoryApi CRUD + lifecycle", () => {
  it("get fetches /categories/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CATEGORY));
    await categoryApi.get("ws-1", "cat-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/categories/cat-1",
    );
  });

  it("create POSTs /categories with the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CATEGORY));
    await categoryApi.create("ws-1", { name: "Tools" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/categories");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ name: "Tools" }));
  });

  it("update PATCHes /categories/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(CATEGORY));
    await categoryApi.update("ws-1", "cat-1", { description: "" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/categories/cat-1");
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

    await categoryApi.archive("ws-1", "cat-1");
    await categoryApi.restore("ws-1", "cat-1");
    await categoryApi.del("ws-1", "cat-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/categories/cat-1/archive");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toContain("/categories/cat-1/restore");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[2][0]).toContain("/categories/cat-1");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
  });
});
