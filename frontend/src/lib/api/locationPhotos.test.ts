import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locationPhotosApi } from "./locationPhotos";

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const RAW = {
  id: "lp-1",
  location_id: "loc-1",
  file_id: "f-1",
  original_name: "shelf.jpg",
  mime_type: "image/jpeg",
  size_bytes: 1234,
  created_at: "2026-07-27T00:00:00Z",
  url: "/workspaces/ws-1/location-photos/lp-1/file",
};

describe("locationPhotosApi", () => {
  it("rewrites the serve URL to the /api-proxied form", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [RAW] }));

    const photos = await locationPhotosApi.list("ws-1", "loc-1");

    expect(photos[0].url).toBe(
      "/api/workspaces/ws-1/location-photos/lp-1/file",
    );
    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/workspaces/ws-1/locations/loc-1/photos",
    );
  });

  it("tolerates a response with no items array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await expect(locationPhotosApi.list("ws-1", "loc-1")).resolves.toEqual([]);
  });

  it("uploads under the multipart field the backend expects", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(RAW));
    const file = new File(["bytes"], "shelf.jpg", { type: "image/jpeg" });

    await locationPhotosApi.upload("ws-1", "loc-1", file, "north wall");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/workspaces/ws-1/locations/loc-1/photos");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(form.get("photo")).toBe(file);
    expect(form.get("caption")).toBe("north wall");
    // Content-Type must be left to the browser so the multipart boundary is set.
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("omits an empty caption", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(RAW));
    const file = new File(["bytes"], "shelf.jpg", { type: "image/jpeg" });

    await locationPhotosApi.upload("ws-1", "loc-1", file);

    const form = fetchMock.mock.calls[0][1].body as FormData;
    expect(form.has("caption")).toBe(false);
  });
});
