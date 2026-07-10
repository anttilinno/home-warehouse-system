import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { labelsApi } from "./labels";

// Phase 7/10 Plan 01 (TAX-07) — labelsApi unit tests. Stubs global.fetch (the
// Phase 65 canonical fetch-mock pattern, mirroring items.test.ts) to assert the
// exact URL shape each method builds and that listWorkspaceLabels /
// getItemLabelIds unwrap their bare envelopes (Pitfall 2: no `.total`).

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

const LABEL = {
  id: "lbl-1",
  workspace_id: "ws-1",
  name: "Fragile",
  color: "#ff0000",
  is_archived: false,
  created_at: "2026-06-13T00:00:00Z",
  updated_at: "2026-06-13T00:00:00Z",
};

describe("labelsApi item-label links", () => {
  it("getItemLabelIds hits /items/{id}/labels and unwraps label_ids", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ label_ids: ["lbl-1", "lbl-2"] }),
    );
    const res = await labelsApi.getItemLabelIds("ws-1", "it-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/items/it-1/labels",
    );
    expect(res).toEqual(["lbl-1", "lbl-2"]);
  });

  it("attach POSTs /items/{id}/labels/{labelId}", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await labelsApi.attach("ws-1", "it-1", "lbl-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1/labels/lbl-1");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("detach DELETEs /items/{id}/labels/{labelId}", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await labelsApi.detach("ws-1", "it-1", "lbl-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/items/it-1/labels/lbl-1");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("labelsApi.listWorkspaceLabels (bare {items} — Pitfall 2)", () => {
  it("hits /labels and unwraps to Label[]", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ items: [LABEL] }));
    const res = await labelsApi.listWorkspaceLabels("ws-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/labels",
    );
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("lbl-1");
  });
});

describe("labelsApi manager CRUD + lifecycle (TAX-07)", () => {
  it("get fetches /labels/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LABEL));
    await labelsApi.get("ws-1", "lbl-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/labels/lbl-1",
    );
  });

  it("create POSTs /labels with the body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LABEL));
    await labelsApi.create("ws-1", { name: "Fragile", color: "#ff0000" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/labels");
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ name: "Fragile", color: "#ff0000" }),
    );
  });

  it("update PATCHes /labels/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(LABEL));
    await labelsApi.update("ws-1", "lbl-1", { description: "" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/labels/lbl-1");
    expect((init as RequestInit).method).toBe("PATCH");
    expect((init as RequestInit).body).toBe(
      JSON.stringify({ description: "" }),
    );
  });

  it("archive/restore POST and del DELETEs", async () => {
    fetchMock
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204))
      .mockResolvedValueOnce(emptyResponse(204));

    await labelsApi.archive("ws-1", "lbl-1");
    await labelsApi.restore("ws-1", "lbl-1");
    await labelsApi.del("ws-1", "lbl-1");

    expect(fetchMock.mock.calls[0][0]).toContain("/labels/lbl-1/archive");
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[1][0]).toContain("/labels/lbl-1/restore");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("POST");
    expect(fetchMock.mock.calls[2][0]).toContain("/labels/lbl-1");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
  });
});
