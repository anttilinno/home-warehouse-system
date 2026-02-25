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

import { itemsApi } from "../items";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("itemsApi", () => {
  it("list fetches items without params", async () => {
    const response = { items: [], total: 0 };
    mockApiClient.get.mockResolvedValueOnce(response);

    const result = await itemsApi.list("ws-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/items"
    );
    expect(result).toEqual(response);
  });

  it("list includes pagination query params", async () => {
    const response = { items: [], total: 0 };
    mockApiClient.get.mockResolvedValueOnce(response);

    await itemsApi.list("ws-1", { page: 2, limit: 10 });

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/items?page=2&limit=10"
    );
  });

  it("search fetches items by query and returns items array", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      items: [{ id: "1", name: "Hammer" }],
    });

    const result = await itemsApi.search("ws-1", "hammer");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/search?q=hammer"
    );
    expect(result).toEqual([{ id: "1", name: "Hammer" }]);
  });

  it("search includes limit param when provided", async () => {
    mockApiClient.get.mockResolvedValueOnce({ items: [] });

    await itemsApi.search("ws-1", "hammer", 5);

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/search?q=hammer&limit=5"
    );
  });

  it("get fetches single item by id", async () => {
    const item = { id: "item-1", name: "Hammer" };
    mockApiClient.get.mockResolvedValueOnce(item);

    const result = await itemsApi.get("ws-1", "item-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/item-1"
    );
    expect(result).toEqual(item);
  });

  it("create posts new item data", async () => {
    const data = { name: "Drill", quantity: 1 };
    const created = { id: "item-2", ...data };
    mockApiClient.post.mockResolvedValueOnce(created);

    const result = await itemsApi.create("ws-1", data as any);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/items",
      data
    );
    expect(result).toEqual(created);
  });

  it("update patches existing item", async () => {
    const data = { name: "Updated Drill" };
    const updated = { id: "item-1", ...data };
    mockApiClient.patch.mockResolvedValueOnce(updated);

    const result = await itemsApi.update("ws-1", "item-1", data as any);

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/item-1",
      data
    );
    expect(result).toEqual(updated);
  });

  it("archive posts to archive endpoint", async () => {
    mockApiClient.post.mockResolvedValueOnce(undefined);

    await itemsApi.archive("ws-1", "item-1");

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/item-1/archive"
    );
  });

  it("restore posts to restore endpoint", async () => {
    mockApiClient.post.mockResolvedValueOnce(undefined);

    await itemsApi.restore("ws-1", "item-1");

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/item-1/restore"
    );
  });

  it("getLabels fetches and returns label_ids array", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      label_ids: ["lbl-1", "lbl-2"],
    });

    const result = await itemsApi.getLabels("ws-1", "item-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/item-1/labels"
    );
    expect(result).toEqual(["lbl-1", "lbl-2"]);
  });

  it("attachLabel posts to label attachment endpoint", async () => {
    mockApiClient.post.mockResolvedValueOnce(undefined);

    await itemsApi.attachLabel("ws-1", "item-1", "lbl-1");

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/item-1/labels/lbl-1"
    );
  });

  it("detachLabel deletes label from item", async () => {
    mockApiClient.delete.mockResolvedValueOnce(undefined);

    await itemsApi.detachLabel("ws-1", "item-1", "lbl-1");

    expect(mockApiClient.delete).toHaveBeenCalledWith(
      "/workspaces/ws-1/items/item-1/labels/lbl-1"
    );
  });
});
