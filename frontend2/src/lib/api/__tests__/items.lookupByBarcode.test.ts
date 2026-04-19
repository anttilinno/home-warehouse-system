// Phase 65 Plan 65-10 — gap closure G-65-01.
// Tests exercise the full request stack: itemsApi.lookupByBarcode must
// now call GET /api/workspaces/{wsId}/items/by-barcode/{code} (NOT the
// old /items?search= wrap) so every real barcode scan hits the
// dedicated ix_items_barcode btree index at the DB layer. Mocking
// global.fetch (instead of itemsApi.list) is the whole point — the
// previous higher-level mock is exactly what let G-65-01 ship.
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { itemsApi, type Item } from "@/lib/api/items";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "item-1",
    workspace_id: "ws-1",
    sku: "SKU-1",
    name: "Cola",
    description: null,
    category_id: null,
    brand: null,
    model: null,
    image_url: null,
    serial_number: null,
    manufacturer: null,
    barcode: "5449000000996",
    is_insured: null,
    is_archived: null,
    lifetime_warranty: null,
    needs_review: null,
    warranty_details: null,
    purchased_from: null,
    min_stock_level: 0,
    short_code: "SC-1",
    created_at: "2026-04-19T00:00:00Z",
    updated_at: "2026-04-19T00:00:00Z",
    ...overrides,
  } as Item;
}

describe("itemsApi.lookupByBarcode (Plan 65-10 / gap G-65-01)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("smoke: itemsApi barrel is importable with expected siblings", () => {
    expect(typeof itemsApi.list).toBe("function");
    expect(typeof itemsApi.get).toBe("function");
    expect(typeof itemsApi.create).toBe("function");
    expect(typeof itemsApi.lookupByBarcode).toBe("function");
  });

  it("G-65-01 URL shape: calls GET /api/workspaces/{wsId}/items/by-barcode/{code} (NOT /items?search=)", async () => {
    const match = makeItem({ barcode: "5449000000996" });
    fetchSpy.mockImplementation(async () =>
      new Response(JSON.stringify(match), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    await itemsApi.lookupByBarcode("ws-1", "5449000000996");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toContain("/api/workspaces/ws-1/items/by-barcode/5449000000996");
    expect(String(url)).not.toContain("?search=");
    expect(String(url)).not.toContain("limit=1");
    expect(init.method).toBe("GET");
  });

  it("G-65-01 URL shape: encodeURIComponent defence for codes with special chars", async () => {
    fetchSpy.mockImplementation(async () =>
      new Response(null, { status: 404 }),
    );

    // Even though the itemCreateSchema regex and scanner can't feed special
    // chars today, the helper must be encodeURIComponent-safe for any
    // future format (defense in depth matches barcode.test.ts line 55-63).
    await itemsApi.lookupByBarcode("ws-1", "AB/CD 12").catch(() => null);

    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    // encodeURIComponent("AB/CD 12") === "AB%2FCD%2012"
    expect(String(url)).toContain("/api/workspaces/ws-1/items/by-barcode/AB%2FCD%2012");
  });

  it("happy path: returns the Item on 200 with exact barcode + workspace match", async () => {
    const match = makeItem({
      id: "match-id",
      workspace_id: "ws-1",
      barcode: "5449000000996",
      name: "Cola",
    });
    fetchSpy.mockImplementation(async () =>
      new Response(JSON.stringify(match), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await itemsApi.lookupByBarcode("ws-1", "5449000000996");
    expect(result).toEqual(match);
  });

  it("404 → null: backend not-found returns null (NOT throws) — preserves useScanLookup not-found contract", async () => {
    fetchSpy.mockImplementation(async () =>
      new Response(JSON.stringify({ detail: "item not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await itemsApi.lookupByBarcode("ws-1", "DOES-NOT-EXIST");
    expect(result).toBeNull();
  });

  it("D-07 defense-in-depth: returns null on case-sensitive barcode mismatch (catches cache/proxy anomalies)", async () => {
    // When GTIN-14 canonicalization or case-insensitive match ships (see 65-CONTEXT.md §Deferred Ideas), this test's
    // behavior will need to be revisited — the backend becoming liberal in what it accepts requires this frontend
    // guard to loosen too, or be removed.
    //
    // Backend should never return a mismatching barcode for this endpoint
    // (it uses `WHERE barcode = $2` exact match), but the guard is cheap
    // and protects against in-flight cache staleness or a buggy proxy.
    const stale = makeItem({ barcode: "abc-123", workspace_id: "ws-1" });
    fetchSpy.mockImplementation(async () =>
      new Response(JSON.stringify(stale), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const result = await itemsApi.lookupByBarcode("ws-1", "ABC-123");
    expect(result).toBeNull();
  });

  it("D-08 defense-in-depth: logs {kind: 'scan-workspace-mismatch'} and returns null on workspace mismatch (Pitfall #5)", async () => {
    const other = makeItem({
      workspace_id: "ws-OTHER",
      barcode: "5449000000996",
    });
    fetchSpy.mockImplementation(async () =>
      new Response(JSON.stringify(other), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await itemsApi.lookupByBarcode("ws-1", "5449000000996");

    expect(result).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "scan-workspace-mismatch",
        code: "5449000000996",
        returnedWs: "ws-OTHER",
        sessionWs: "ws-1",
      }),
    );
  });

  it("5xx propagates: non-404 HttpError is thrown so useScanLookup's ERROR state (D-21) fires", async () => {
    fetchSpy.mockImplementation(async () =>
      new Response(JSON.stringify({ detail: "db down" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(
      itemsApi.lookupByBarcode("ws-1", "5449000000996"),
    ).rejects.toMatchObject({
      name: "HttpError",
      status: 500,
    });
  });
});
