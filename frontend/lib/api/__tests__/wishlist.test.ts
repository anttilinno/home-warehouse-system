import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../client", () => ({ apiClient: mockApiClient }));

import { wishlistApi } from "../wishlist";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wishlistApi", () => {
  it("list fetches wishlist items without params", async () => {
    const response = { items: [{ id: "w-1", name: "Drill" }], total: 1 };
    mockApiClient.get.mockResolvedValueOnce(response);

    const result = await wishlistApi.list("ws-1");

    expect(mockApiClient.get).toHaveBeenCalledWith("/workspaces/ws-1/wishlist");
    expect(result).toEqual(response);
  });

  it("list passes status filter and pagination", async () => {
    mockApiClient.get.mockResolvedValueOnce({ items: [], total: 0 });

    await wishlistApi.list("ws-1", { status: "wanted", page: 2, limit: 10 });

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/wishlist?status=wanted&page=2&limit=10"
    );
  });

  it("create posts new wishlist item data", async () => {
    const created = { id: "w-1", name: "Drill", status: "wanted" };
    mockApiClient.post.mockResolvedValueOnce(created);

    const result = await wishlistApi.create("ws-1", {
      name: "Drill",
      priority: 1,
      price_estimate: 12999,
      currency_code: "EUR",
    });

    expect(mockApiClient.post).toHaveBeenCalledWith("/workspaces/ws-1/wishlist", {
      name: "Drill",
      priority: 1,
      price_estimate: 12999,
      currency_code: "EUR",
    });
    expect(result).toEqual(created);
  });

  it("update patches status transition with acquired item link", async () => {
    const updated = { id: "w-1", status: "acquired", acquired_item_id: "item-1" };
    mockApiClient.patch.mockResolvedValueOnce(updated);

    const result = await wishlistApi.update("ws-1", "w-1", {
      status: "acquired",
      acquired_item_id: "item-1",
    });

    expect(mockApiClient.patch).toHaveBeenCalledWith("/workspaces/ws-1/wishlist/w-1", {
      status: "acquired",
      acquired_item_id: "item-1",
    });
    expect(result).toEqual(updated);
  });

  it("delete removes a wishlist item", async () => {
    mockApiClient.delete.mockResolvedValueOnce(undefined);

    await wishlistApi.delete("ws-1", "w-1");

    expect(mockApiClient.delete).toHaveBeenCalledWith("/workspaces/ws-1/wishlist/w-1");
  });
});
