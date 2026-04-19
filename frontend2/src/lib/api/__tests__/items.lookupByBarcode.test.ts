// Phase 65 Plan 65-02 Task 2 — RED→GREEN.
// Converts the 5 scaffolded it.todo entries into real it() blocks that assert
// D-06 (wraps itemsApi.list), D-07 (case-sensitive exact-barcode guard + empty
// list), and D-08 (workspace defense-in-depth + structured console.error)
// for the new itemsApi.lookupByBarcode helper landing in items.ts in Step B.
import { afterEach, describe, it, expect, vi } from "vitest";
import { itemsApi, type Item } from "@/lib/api/items";

describe("itemsApi.lookupByBarcode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("itemsApi barrel is importable and has the expected siblings", () => {
    expect(typeof itemsApi.list).toBe("function");
    expect(typeof itemsApi.get).toBe("function");
    expect(typeof itemsApi.create).toBe("function");
  });

  it("D-06/D-07: returns null on empty items[] response", async () => {
    vi.spyOn(itemsApi, "list").mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      total_pages: 0,
    });
    await expect(
      itemsApi.lookupByBarcode("ws-1", "5449000000996"),
    ).resolves.toBeNull();
  });

  it("D-07: returns null on case-sensitive barcode mismatch", async () => {
    const stale: Item = {
      id: "x",
      workspace_id: "ws-1",
      barcode: "abc-123",
      sku: "",
      name: "",
      short_code: "",
      min_stock_level: 0,
      created_at: "",
      updated_at: "",
    } as Item;
    vi.spyOn(itemsApi, "list").mockResolvedValue({
      items: [stale],
      total: 1,
      page: 1,
      total_pages: 1,
    });
    await expect(
      itemsApi.lookupByBarcode("ws-1", "ABC-123"),
    ).resolves.toBeNull();
  });

  it("D-08: logs { kind: \"scan-workspace-mismatch\" } and returns null on workspace_id mismatch (Pitfall #5)", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const other: Item = {
      id: "x",
      workspace_id: "ws-OTHER",
      barcode: "5449000000996",
      sku: "",
      name: "",
      short_code: "",
      min_stock_level: 0,
      created_at: "",
      updated_at: "",
    } as Item;
    vi.spyOn(itemsApi, "list").mockResolvedValue({
      items: [other],
      total: 1,
      page: 1,
      total_pages: 1,
    });

    await expect(
      itemsApi.lookupByBarcode("ws-1", "5449000000996"),
    ).resolves.toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "scan-workspace-mismatch",
        code: "5449000000996",
        returnedWs: "ws-OTHER",
        sessionWs: "ws-1",
      }),
    );
  });

  it("D-06: returns the Item on exact barcode + workspace match", async () => {
    const match: Item = {
      id: "match-id",
      workspace_id: "ws-1",
      barcode: "5449000000996",
      sku: "",
      name: "Cola",
      short_code: "ABC123",
      min_stock_level: 0,
      created_at: "",
      updated_at: "",
    } as Item;
    vi.spyOn(itemsApi, "list").mockResolvedValue({
      items: [match],
      total: 1,
      page: 1,
      total_pages: 1,
    });
    await expect(
      itemsApi.lookupByBarcode("ws-1", "5449000000996"),
    ).resolves.toBe(match);
  });

  it("D-06: invokes itemsApi.list with { search: code, limit: 1 }", async () => {
    const spy = vi
      .spyOn(itemsApi, "list")
      .mockResolvedValue({ items: [], total: 0, page: 1, total_pages: 0 });
    await itemsApi.lookupByBarcode("ws-1", "5449000000996");
    expect(spy).toHaveBeenCalledWith("ws-1", {
      search: "5449000000996",
      limit: 1,
    });
  });
});
