import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { itemAttachmentsApi } from "./attachments";

// Phase 14b Plan 03 — itemAttachmentsApi unit tests. Stubs global.fetch (the
// Phase 65 canonical fetch-mock pattern, mirroring items.test.ts) to assert the
// exact URL shape each method builds, that upload() posts multipart FormData
// (not JSON — REAL byte upload, unlike repairAttachments.ts's metadata-only
// file_id), and that downloadUrl builds a same-origin /api-relative path.

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

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ATTACHMENT = {
  id: "att-1",
  item_id: "it-1",
  file_id: "file-1",
  attachment_type: "manual",
  is_primary: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("itemAttachmentsApi.list (bare {items})", () => {
  it("hits /items/{itemId}/attachments and returns items without total", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [ATTACHMENT] }));

    const res = await itemAttachmentsApi.list("ws-1", "it-1");

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/items/it-1/attachments");
    expect(res.items).toHaveLength(1);
    expect((res as { total?: number }).total).toBeUndefined();
  });
});

describe("itemAttachmentsApi.upload (real multipart bytes)", () => {
  it("POSTs FormData to /items/{itemId}/attachments/file", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ATTACHMENT));

    const form = new FormData();
    form.set("file", new Blob(["x"]), "doc.pdf");
    form.set("attachment_type", "manual");

    await itemAttachmentsApi.upload("ws-1", "it-1", form);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1/attachments/file");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });
});

describe("itemAttachmentsApi setPrimary/del", () => {
  it("setPrimary POSTs /items/{itemId}/attachments/{id}/set-primary", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await itemAttachmentsApi.setPrimary("ws-1", "it-1", "att-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain(
      "/workspaces/ws-1/items/it-1/attachments/att-1/set-primary",
    );
    expect((init as RequestInit).method).toBe("POST");
  });

  it("del DELETEs /attachments/{id} (workspace-scoped, NOT nested under item)", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await itemAttachmentsApi.del("ws-1", "att-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/attachments/att-1");
    expect(url).not.toContain("/items/");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("itemAttachmentsApi.downloadUrl", () => {
  it("builds a same-origin /api-relative file url", () => {
    const url = itemAttachmentsApi.downloadUrl("ws-1", "att-1");
    expect(url).toBe("/api/workspaces/ws-1/attachments/att-1/file");
  });
});
