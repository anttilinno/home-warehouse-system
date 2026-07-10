import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repairPhotosApi } from "./repairPhotos";

// Phase 4 Plan 01 (test-gaps 4.1) — repairPhotosApi unit tests. Stubs
// global.fetch (canonical fetch-mock pattern, mirroring photos.test.ts) to
// assert URL/payload shape and the url/thumbnail_url rewrite to /api-relative.

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

const ABS = "http://localhost:8080";
const PHOTO = {
  id: "rp-1",
  repair_id: "rep-1",
  photo_type: "BEFORE",
  url: `${ABS}/workspaces/ws-1/repairs/rep-1/photos/rp-1`,
  thumbnail_url: `${ABS}/workspaces/ws-1/repairs/rep-1/photos/rp-1/thumbnail`,
};

describe("repairPhotosApi.list", () => {
  it("fetches /repairs/{id}/photos/list and rewrites url + thumbnail_url", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([PHOTO]));
    const photos = await repairPhotosApi.list("ws-1", "rep-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/repairs/rep-1/photos/list",
    );
    expect(photos[0].url.startsWith("/api/")).toBe(true);
    expect(photos[0].thumbnail_url.startsWith("/api/")).toBe(true);
  });
});

describe("repairPhotosApi.upload", () => {
  it("posts multipart with field 'photo' and required 'photo_type'", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTO));
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

    const photo = await repairPhotosApi.upload("ws-1", "rep-1", file, "BEFORE");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1/photos");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as FormData;
    expect(body.get("photo")).toBeInstanceOf(File);
    expect(body.get("photo_type")).toBe("BEFORE");
    expect(photo.url.startsWith("/api/")).toBe(true);
  });

  it("appends caption when provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTO));
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    await repairPhotosApi.upload("ws-1", "rep-1", file, "AFTER", "done");
    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(body.get("caption")).toBe("done");
  });
});

describe("repairPhotosApi.updateCaption", () => {
  it("PUTs /photos/{id}/caption with {caption}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTO));
    await repairPhotosApi.updateCaption("ws-1", "rep-1", "rp-1", "hello");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(
      "/workspaces/ws-1/repairs/rep-1/photos/rp-1/caption",
    );
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ caption: "hello" }),
    );
  });
});

describe("repairPhotosApi.del", () => {
  it("DELETEs /photos/{id}", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await repairPhotosApi.del("ws-1", "rep-1", "rp-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1/photos/rp-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
