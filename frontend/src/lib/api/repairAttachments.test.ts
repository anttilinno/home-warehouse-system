import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { repairAttachmentsApi } from "./repairAttachments";

// Phase 4 Plan 01 (test-gaps 4.1) — repairAttachmentsApi unit tests. Stubs
// global.fetch (canonical fetch-mock pattern, mirroring loans.test.ts) to
// assert URL/payload shape for list/create/del.

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

const ATTACHMENT = {
  id: "att-1",
  repair_id: "rep-1",
  file_id: "file-1",
  attachment_type: "PHOTO",
};

describe("repairAttachmentsApi.list", () => {
  it("fetches /repairs/{id}/attachments", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [ATTACHMENT], total: 1 }),
    );
    await repairAttachmentsApi.list("ws-1", "rep-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/repairs/rep-1/attachments",
    );
  });
});

describe("repairAttachmentsApi.create", () => {
  it("POSTs /repairs/{id}/attachments with file_id + attachment_type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(ATTACHMENT));
    await repairAttachmentsApi.create("ws-1", "rep-1", {
      file_id: "file-1",
      attachment_type: "PHOTO",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1/attachments");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ file_id: "file-1", attachment_type: "PHOTO" }),
    );
  });
});

describe("repairAttachmentsApi.del", () => {
  it("DELETEs /repairs/{id}/attachments/{attachmentId}", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await repairAttachmentsApi.del("ws-1", "rep-1", "att-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/repairs/rep-1/attachments/att-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});
