import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { itemsApi } from "./items";

// Phase 7 Plan 01 Task 2 — itemsApi unit tests. We stub `global.fetch` directly
// (Phase 65 canonical fetch-mock pattern) rather than MSW so we can assert the
// exact URL shape each call builds. lookupByBarcode is the ITEM-09 guard:
// 404→null, encodeURIComponent path-injection defense (T-07-02), 500-propagation,
// case-sensitive (no client normalization — Phase 65 D-07).

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

const ITEM = {
  id: "it-1",
  workspace_id: "ws-1",
  sku: "SKU1",
  name: "Drill",
  min_stock_level: 0,
  short_code: "abc123",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("itemsApi.lookupByBarcode (ITEM-09)", () => {
  it("hits /items/by-barcode/{code} — NOT the ?search= list endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ITEM));

    await itemsApi.lookupByBarcode("ws-1", "0123456789");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/items/by-barcode/0123456789");
    expect(url).not.toContain("?search=");
  });

  it("encodeURIComponent-encodes the barcode (path-injection guard T-07-02)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ITEM));

    await itemsApi.lookupByBarcode("ws-1", "AB/CD 12");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/items/by-barcode/AB%2FCD%2012");
  });

  it("returns the Item on 200", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ITEM));
    const result = await itemsApi.lookupByBarcode("ws-1", "0123456789");
    expect(result).toMatchObject({ id: "it-1", name: "Drill" });
  });

  it("returns null on 404 (no match)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "not found" }, 404));
    const result = await itemsApi.lookupByBarcode("ws-1", "nope");
    expect(result).toBeNull();
  });

  it("rethrows on 500 (server error must surface, not be swallowed as null)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ detail: "boom" }, 500));
    await expect(itemsApi.lookupByBarcode("ws-1", "x")).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("itemsApi.list", () => {
  it("rewrites primary-photo absolute URLs to /api-relative", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            ...ITEM,
            primary_photo_url: "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1",
            primary_photo_thumbnail_url:
              "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1/thumbnail",
          },
        ],
        total: 1,
        page: 1,
        total_pages: 1,
      }),
    );

    const res = await itemsApi.list("ws-1", { search: "drill" });

    expect(res.items[0].primary_photo_url).toBe(
      "/api/workspaces/ws-1/items/it-1/photos/p-1",
    );
    expect(res.items[0].primary_photo_thumbnail_url).toBe(
      "/api/workspaces/ws-1/items/it-1/photos/p-1/thumbnail",
    );
  });

  it("omits empty params and builds a query string of the rest", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );

    await itemsApi.list("ws-1", {
      search: "drill",
      category_id: "",
      archived: true,
      sort: "name",
      page: 2,
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/items?");
    expect(url).toContain("search=drill");
    expect(url).toContain("archived=true");
    expect(url).toContain("sort=name");
    expect(url).toContain("page=2");
    expect(url).not.toContain("category_id=");
  });

  it("leaves items without primary-photo urls untouched", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [ITEM], total: 1, page: 1, total_pages: 1 }),
    );
    const res = await itemsApi.list("ws-1", {});
    expect(res.items[0].primary_photo_url).toBeUndefined();
  });
});

describe("itemsApi CRUD + lifecycle", () => {
  it("get fetches /items/{id} and rewrites primary-photo urls", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ...ITEM,
        primary_photo_url: "http://localhost:8080/workspaces/ws-1/items/it-1/photos/p-1",
      }),
    );
    const item = await itemsApi.get("ws-1", "it-1");
    expect((fetchMock.mock.calls[0][0] as string)).toContain(
      "/workspaces/ws-1/items/it-1",
    );
    expect(item.primary_photo_url).toBe(
      "/api/workspaces/ws-1/items/it-1/photos/p-1",
    );
  });

  it("create POSTs to /items", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ITEM));
    await itemsApi.create("ws-1", { sku: "SKU1", name: "Drill" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("update PATCHes /items/{id} (omitted=unchanged, ''=clear — no default injection)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ITEM));
    await itemsApi.update("ws-1", "it-1", { description: "" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(JSON.stringify({ description: "" }));
  });

  it("archive/restore POST and del DELETEs", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204));

    await itemsApi.archive("ws-1", "it-1");
    await itemsApi.restore("ws-1", "it-1");
    await itemsApi.del("ws-1", "it-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/items/it-1/archive");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toContain("/items/it-1/restore");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[2][0]).toContain("/items/it-1");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
  });
});
