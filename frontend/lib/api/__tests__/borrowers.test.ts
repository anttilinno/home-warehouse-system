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

import { borrowersApi } from "../borrowers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("borrowersApi", () => {
  it("list fetches borrowers", async () => {
    const response = { items: [], total: 0 };
    mockApiClient.get.mockResolvedValueOnce(response);

    const result = await borrowersApi.list("ws-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/borrowers"
    );
    expect(result).toEqual(response);
  });

  it("get fetches single borrower by id", async () => {
    const borrower = { id: "b-1", name: "Alice" };
    mockApiClient.get.mockResolvedValueOnce(borrower);

    const result = await borrowersApi.get("ws-1", "b-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/borrowers/b-1"
    );
    expect(result).toEqual(borrower);
  });

  it("create posts new borrower data", async () => {
    const data = { name: "Bob" };
    const created = { id: "b-2", ...data };
    mockApiClient.post.mockResolvedValueOnce(created);

    const result = await borrowersApi.create("ws-1", data as any);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/borrowers",
      data
    );
    expect(result).toEqual(created);
  });

  it("update patches existing borrower", async () => {
    const data = { name: "Updated Alice" };
    const updated = { id: "b-1", ...data };
    mockApiClient.patch.mockResolvedValueOnce(updated);

    const result = await borrowersApi.update("ws-1", "b-1", data as any);

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      "/workspaces/ws-1/borrowers/b-1",
      data
    );
    expect(result).toEqual(updated);
  });

  it("delete removes borrower by id", async () => {
    mockApiClient.delete.mockResolvedValueOnce(undefined);

    await borrowersApi.delete("ws-1", "b-1");

    expect(mockApiClient.delete).toHaveBeenCalledWith(
      "/workspaces/ws-1/borrowers/b-1"
    );
  });

  it("search fetches borrowers by query and returns items", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      items: [{ id: "b-1", name: "Alice" }],
    });

    const result = await borrowersApi.search("ws-1", "alice");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/borrowers/search?q=alice"
    );
    expect(result).toEqual([{ id: "b-1", name: "Alice" }]);
  });

  it("search returns empty array on 404 error", async () => {
    mockApiClient.get.mockRejectedValueOnce({ status: 404 });

    const result = await borrowersApi.search("ws-1", "alice");

    expect(result).toEqual([]);
  });

  it("search rethrows non-404 errors", async () => {
    const error = new Error("Server error");
    mockApiClient.get.mockRejectedValueOnce(error);

    await expect(borrowersApi.search("ws-1", "alice")).rejects.toThrow(
      "Server error"
    );
  });
});
