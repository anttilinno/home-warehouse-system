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

import { locationsApi } from "../locations";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("locationsApi", () => {
  it("list fetches locations", async () => {
    const response = { items: [], total: 0 };
    mockApiClient.get.mockResolvedValueOnce(response);

    const result = await locationsApi.list("ws-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations"
    );
    expect(result).toEqual(response);
  });

  it("get fetches single location by id", async () => {
    const location = { id: "loc-1", name: "Garage" };
    mockApiClient.get.mockResolvedValueOnce(location);

    const result = await locationsApi.get("ws-1", "loc-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations/loc-1"
    );
    expect(result).toEqual(location);
  });

  it("create posts new location data", async () => {
    const data = { name: "Shed" };
    const created = { id: "loc-2", ...data };
    mockApiClient.post.mockResolvedValueOnce(created);

    const result = await locationsApi.create("ws-1", data as any);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations",
      data
    );
    expect(result).toEqual(created);
  });

  it("update patches existing location", async () => {
    const data = { name: "Updated Garage" };
    const updated = { id: "loc-1", ...data };
    mockApiClient.patch.mockResolvedValueOnce(updated);

    const result = await locationsApi.update("ws-1", "loc-1", data as any);

    expect(mockApiClient.patch).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations/loc-1",
      data
    );
    expect(result).toEqual(updated);
  });

  it("archive posts to archive endpoint", async () => {
    mockApiClient.post.mockResolvedValueOnce(undefined);

    await locationsApi.archive("ws-1", "loc-1");

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations/loc-1/archive"
    );
  });

  it("restore posts to restore endpoint", async () => {
    mockApiClient.post.mockResolvedValueOnce(undefined);

    await locationsApi.restore("ws-1", "loc-1");

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations/loc-1/restore"
    );
  });

  it("delete removes location by id", async () => {
    mockApiClient.delete.mockResolvedValueOnce(undefined);

    await locationsApi.delete("ws-1", "loc-1");

    expect(mockApiClient.delete).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations/loc-1"
    );
  });

  it("search fetches locations by query and returns items", async () => {
    mockApiClient.get.mockResolvedValueOnce({
      items: [{ id: "loc-1", name: "Garage" }],
    });

    const result = await locationsApi.search("ws-1", "garage");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations/search?q=garage"
    );
    expect(result).toEqual([{ id: "loc-1", name: "Garage" }]);
  });

  it("search returns empty array on 404 error", async () => {
    mockApiClient.get.mockRejectedValueOnce({ status: 404 });

    const result = await locationsApi.search("ws-1", "garage");

    expect(result).toEqual([]);
  });

  it("search rethrows non-404 errors", async () => {
    const error = new Error("Server error");
    mockApiClient.get.mockRejectedValueOnce(error);

    await expect(locationsApi.search("ws-1", "garage")).rejects.toThrow(
      "Server error"
    );
  });

  it("getBreadcrumb fetches breadcrumb trail for a location", async () => {
    const breadcrumb = {
      items: [
        { id: "loc-root", name: "Home" },
        { id: "loc-1", name: "Garage" },
      ],
    };
    mockApiClient.get.mockResolvedValueOnce(breadcrumb);

    const result = await locationsApi.getBreadcrumb("ws-1", "loc-1");

    expect(mockApiClient.get).toHaveBeenCalledWith(
      "/workspaces/ws-1/locations/loc-1/breadcrumb"
    );
    expect(result).toEqual(breadcrumb);
  });
});
