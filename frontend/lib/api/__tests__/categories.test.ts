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

import { categoriesApi } from "../categories";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("categoriesApi", () => {
  it("list fetches categories and returns items array", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      items: [{ id: "1", name: "Tools" }],
    });

    const result = await categoriesApi.list("ws-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/categories"
    );
    expect(result).toEqual([{ id: "1", name: "Tools" }]);
  });

  it("create posts new category data", async () => {
    const created = { id: "1", name: "Tools" };
    mockApiClient.post.mockResolvedValueOnce(created);

    const result = await categoriesApi.create("ws-1", { name: "Tools" });

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/categories",
      { name: "Tools" }
    );
    expect(result).toEqual(created);
  });

  it("update patches existing category", async () => {
    const updated = { id: "cat-1", name: "Updated" };
    mockApiClient.patch.mockResolvedValueOnce(updated);

    const result = await categoriesApi.update("ws-1", "cat-1", {
      name: "Updated",
    });

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      "/workspaces/ws-1/categories/cat-1",
      { name: "Updated" }
    );
    expect(result).toEqual(updated);
  });

  it("delete removes category by id", async () => {
    mockApiClient.delete.mockResolvedValueOnce(undefined);

    await categoriesApi.delete("ws-1", "cat-1");

    expect(mockApiClient.delete).toHaveBeenCalledWith(
      "/workspaces/ws-1/categories/cat-1"
    );
  });
});
