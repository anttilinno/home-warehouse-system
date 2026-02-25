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

import { containersApi } from "../containers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("containersApi", () => {
  it("list fetches containers", async () => {
    const response = { items: [], total: 0 };
    mockApiClient.get.mockResolvedValueOnce(response);

    const result = await containersApi.list("ws-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers"
    );
    expect(result).toEqual(response);
  });

  it("get fetches single container by id", async () => {
    const container = { id: "c-1", name: "Box A" };
    mockApiClient.get.mockResolvedValueOnce(container);

    const result = await containersApi.get("ws-1", "c-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers/c-1"
    );
    expect(result).toEqual(container);
  });

  it("create posts new container data", async () => {
    const data = { name: "Box B" };
    const created = { id: "c-2", ...data };
    mockApiClient.post.mockResolvedValueOnce(created);

    const result = await containersApi.create("ws-1", data as any);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers",
      data
    );
    expect(result).toEqual(created);
  });

  it("update patches existing container", async () => {
    const data = { name: "Updated Box" };
    const updated = { id: "c-1", ...data };
    mockApiClient.patch.mockResolvedValueOnce(updated);

    const result = await containersApi.update("ws-1", "c-1", data as any);

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers/c-1",
      data
    );
    expect(result).toEqual(updated);
  });

  it("archive posts to archive endpoint", async () => {
    mockApiClient.post.mockResolvedValueOnce(undefined);

    await containersApi.archive("ws-1", "c-1");

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers/c-1/archive"
    );
  });

  it("restore posts to restore endpoint", async () => {
    mockApiClient.post.mockResolvedValueOnce(undefined);

    await containersApi.restore("ws-1", "c-1");

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers/c-1/restore"
    );
  });

  it("delete removes container by id", async () => {
    mockApiClient.delete.mockResolvedValueOnce(undefined);

    await containersApi.delete("ws-1", "c-1");

    expect(mockApiClient.delete).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers/c-1"
    );
  });

  it("search fetches containers by query and returns items", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      items: [{ id: "c-1", name: "Box A" }],
    });

    const result = await containersApi.search("ws-1", "box");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/containers/search?q=box"
    );
    expect(result).toEqual([{ id: "c-1", name: "Box A" }]);
  });

  it("search returns empty array on 404 error", async () => {
    mockApiClient.get.mockRejectedValueOnce({ status: 404 });

    const result = await containersApi.search("ws-1", "box");

    expect(result).toEqual([]);
  });

  it("search rethrows non-404 errors", async () => {
    const error = new Error("Server error");
    mockApiClient.get.mockRejectedValueOnce(error);

    await expect(containersApi.search("ws-1", "box")).rejects.toThrow(
      "Server error"
    );
  });
});
