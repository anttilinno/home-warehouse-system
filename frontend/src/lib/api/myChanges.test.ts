import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { myChangesApi } from "./myChanges";

// Phase 14 Plan 02 Task 1 — myChangesApi unit tests. Stub `global.fetch`
// directly (the canonical fetch-mock pattern from borrowers.test.ts) so we
// assert the EXACT URL shape and the BARE { changes, total } envelope. The
// defining contract: list(ws) hits /workspaces/{ws}/my-pending-changes and
// resolves `changes` as the row array (NOT items) — identical shape to
// /pending-changes, but the caller's OWN changes (FindByRequester).

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

const CHANGE = {
  id: "chg-1",
  entity_type: "item",
  entity_id: "it-1",
  action: "update" as const,
  status: "pending" as const,
  created_at: "2026-06-13T00:00:00Z",
};

describe("myChangesApi.list", () => {
  it("GETs /workspaces/{ws}/my-pending-changes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ changes: [CHANGE], total: 1 }),
    );

    await myChangesApi.list("ws-1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/my-pending-changes");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("resolves the BARE { changes, total } envelope (key changes, NOT items)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ changes: [CHANGE], total: 1 }),
    );

    const res = await myChangesApi.list("ws-1");

    expect(res.changes).toEqual([CHANGE]);
    expect(res.total).toBe(1);
    // No items wrapper — reading .items is absent at runtime.
    expect((res as Record<string, unknown>).items).toBeUndefined();
  });
});
