import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { photosApi } from "./photos";

// Phase 7 Plan 01 Task 3 — photosApi unit tests. Stub `global.fetch` directly so
// we can assert the multipart field name, the full-order reorder body, the bulk
// shapes, and (critically) that EVERY absolute photo URL is rewritten to
// /api-relative at the mapper boundary (Pitfall 1 / threat T-07-01).

type FetchMock = ReturnType<typeof vi.fn>;
let fetchMock: FetchMock;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

const ABS = "http://localhost:8080";
const PHOTO = {
  id: "p-1",
  item_id: "it-1",
  workspace_id: "ws-1",
  filename: "a.jpg",
  file_size: 100,
  mime_type: "image/jpeg",
  width: 10,
  height: 10,
  display_order: 0,
  is_primary: true,
  url: `${ABS}/workspaces/ws-1/items/it-1/photos/p-1`,
  thumbnail_url: `${ABS}/workspaces/ws-1/items/it-1/photos/p-1/thumbnail`,
  thumbnail_status: "complete",
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("photosApi.list", () => {
  it("rewrites url + thumbnail_url to /api-relative on every photo", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([PHOTO, { ...PHOTO, id: "p-2" }]),
    );

    const photos = await photosApi.list("ws-1", "it-1");

    expect(fetchMock.mock.calls[0][0]).toContain(
      "/workspaces/ws-1/items/it-1/photos/list",
    );
    for (const p of photos) {
      expect(p.url.startsWith("/api/")).toBe(true);
      expect(p.thumbnail_url.startsWith("/api/")).toBe(true);
      expect(p.url).not.toContain("localhost:8080");
    }
  });
});

describe("photosApi.upload", () => {
  it("posts multipart with field name 'photo' and rewrites the returned url", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTO));
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

    const photo = await photosApi.upload("ws-1", "it-1", file);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1/photos");
    expect((init as RequestInit).method).toBe("POST");
    const body = (init as RequestInit).body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("photo")).toBeInstanceOf(File);
    expect(photo.url.startsWith("/api/")).toBe(true);
  });

  it("appends caption when provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTO));
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

    await photosApi.upload("ws-1", "it-1", file, "front");

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(body.get("caption")).toBe("front");
  });
});

describe("photosApi.checkDuplicate", () => {
  it("posts multipart 'photo' and rewrites each duplicate thumbnail_url", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        has_duplicates: true,
        duplicates: [
          {
            photo_id: "p-9",
            item_id: "it-2",
            filename: "dup.jpg",
            similarity_pct: 98,
            thumbnail_url: `${ABS}/workspaces/ws-1/items/it-2/photos/p-9/thumbnail`,
          },
        ],
      }),
    );
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });

    const res = await photosApi.checkDuplicate("ws-1", "it-1", file);

    const body = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(body.get("photo")).toBeInstanceOf(File);
    expect(res.has_duplicates).toBe(true);
    expect(res.duplicates[0].thumbnail_url?.startsWith("/api/")).toBe(true);
  });

  it("leaves a duplicate without a thumbnail_url untouched", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        has_duplicates: false,
        duplicates: [
          {
            photo_id: "p-9",
            item_id: "it-2",
            filename: "x",
            similarity_pct: 0,
          },
        ],
      }),
    );
    const file = new File(["x"], "a.jpg", { type: "image/jpeg" });
    const res = await photosApi.checkDuplicate("ws-1", "it-1", file);
    expect(res.duplicates[0].thumbnail_url).toBeUndefined();
  });
});

describe("photosApi JSON ops", () => {
  it("setPrimary PUTs /photos/{id}/primary", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await photosApi.setPrimary("ws-1", "p-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/photos/p-1/primary");
    expect((init as RequestInit).method).toBe("PUT");
  });

  it("updateCaption PUTs /photos/{id}/caption with {caption}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(PHOTO));
    await photosApi.updateCaption("ws-1", "p-1", "hello");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/photos/p-1/caption");
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ caption: "hello" }),
    );
  });

  it("reorder PUTs /photos/order with the FULL {photo_ids} list", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await photosApi.reorder("ws-1", "it-1", ["p-2", "p-1", "p-3"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1/photos/order");
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ photo_ids: ["p-2", "p-1", "p-3"] }),
    );
  });

  it("del DELETEs /photos/{id}", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await photosApi.del("ws-1", "p-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/photos/p-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("photosApi bulk ops", () => {
  it("bulkDelete POSTs bulk-delete with {photo_ids}", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await photosApi.bulkDelete("ws-1", "it-1", ["p-1", "p-2"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1/photos/bulk-delete");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ photo_ids: ["p-1", "p-2"] }),
    );
  });

  it("bulkCaption POSTs bulk-caption with {updates}", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    const updates = [{ photo_id: "p-1", caption: "a" }];
    await photosApi.bulkCaption("ws-1", "it-1", updates);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1/photos/bulk-caption");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ updates }));
  });
});

describe("photosApi blob downloads", () => {
  beforeEach(() => {
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue("blob:mock"),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: vi.fn(),
    } as unknown as HTMLAnchorElement);
  });

  it("downloadZip hits /photos/download (no ids) with the item filename", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob(["z"]), { status: 200 }),
    );
    await photosApi.downloadZip("ws-1", "it-1");
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/workspaces/ws-1/items/it-1/photos/download",
    );
  });

  it("downloadZip appends ?ids= when ids given", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob(["z"]), { status: 200 }),
    );
    await photosApi.downloadZip("ws-1", "it-1", ["p-1", "p-2"]);
    expect(fetchMock.mock.calls[0][0]).toContain("ids=p-1,p-2");
  });

  it("exportCsv hits /export/item?format=csv", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(new Blob(["c"]), { status: 200 }),
    );
    await photosApi.exportCsv("ws-1");
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/workspaces/ws-1/export/item?format=csv",
    );
  });
});
