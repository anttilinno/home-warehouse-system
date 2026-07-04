import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import type { Item, ItemListResponse } from "@/lib/types";
import { findCachedItemByCode } from "./localBarcodeLookup";

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: "it-1",
    workspace_id: "ws-1",
    sku: "SKU-1",
    name: "Cordless Drill",
    min_stock_level: 4,
    short_code: "ABCD1234",
    barcode: "999",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-10T00:00:00Z",
    ...overrides,
  };
}

function seedItems(client: QueryClient, data: ItemListResponse) {
  client.setQueryData(["items", "ws-1", {}], data);
}

describe("findCachedItemByCode", () => {
  it("matches by short_code", () => {
    const client = new QueryClient();
    seedItems(client, {
      items: [makeItem()],
      total: 1,
      page: 1,
      total_pages: 1,
    });

    expect(findCachedItemByCode(client, "ws-1", "ABCD1234")?.id).toBe("it-1");
  });

  it("matches by barcode", () => {
    const client = new QueryClient();
    seedItems(client, {
      items: [makeItem()],
      total: 1,
      page: 1,
      total_pages: 1,
    });

    expect(findCachedItemByCode(client, "ws-1", "999")?.id).toBe("it-1");
  });

  it("returns null on a miss", () => {
    const client = new QueryClient();
    seedItems(client, {
      items: [makeItem()],
      total: 1,
      page: 1,
      total_pages: 1,
    });

    expect(findCachedItemByCode(client, "ws-1", "NOPE")).toBeNull();
  });

  it("returns null when the cache is empty", () => {
    const client = new QueryClient();

    expect(findCachedItemByCode(client, "ws-1", "ABCD1234")).toBeNull();
  });

  it("tolerates a malformed cache shape without throwing", () => {
    const client = new QueryClient();
    client.setQueryData(["items", "ws-1", {}], { items: "not-an-array" });

    expect(() =>
      findCachedItemByCode(client, "ws-1", "ABCD1234"),
    ).not.toThrow();
    expect(findCachedItemByCode(client, "ws-1", "ABCD1234")).toBeNull();
  });

  it("returns null when wsId or code is missing", () => {
    const client = new QueryClient();
    seedItems(client, {
      items: [makeItem()],
      total: 1,
      page: 1,
      total_pages: 1,
    });

    expect(findCachedItemByCode(client, "", "ABCD1234")).toBeNull();
    expect(findCachedItemByCode(client, "ws-1", "")).toBeNull();
  });
});
