import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsApi } from "./notifications";

// Phase 4 Plan 01 (test-gaps 4.1) — notificationsApi unit tests. Stubs
// global.fetch (the Phase 65 canonical fetch-mock pattern, mirroring
// items.test.ts) to assert URL/payload shape. NOTIF-01/02/03: every endpoint
// is USER-scoped (`/notifications/...`, NO `{ws}` segment).

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

const NOTIFICATION = {
  id: "notif-1",
  user_id: "u-1",
  notification_type: "LOAN_DUE_SOON",
  title: "Loan due soon",
  message: "Return the drill by Friday",
  is_read: false,
  created_at: "2026-06-13T00:00:00Z",
};

describe("notificationsApi.list (no {ws} segment — NOTIF-01)", () => {
  it("builds /notifications?page=&limit= and returns the envelope", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [NOTIFICATION],
        total: 1,
        page: 2,
        total_pages: 1,
      }),
    );
    const res = await notificationsApi.list({ page: 2, limit: 25 });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/notifications?page=2&limit=25");
    expect(res.total).toBe(1);
    expect(res.items).toHaveLength(1);
  });

  it("clamps limit to 100", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );
    await notificationsApi.list({ limit: 500 });
    expect(fetchMock.mock.calls[0][0] as string).toContain("limit=100");
  });

  it("defaults to page=1&limit=50 when opts omitted", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], total: 0, page: 1, total_pages: 0 }),
    );
    await notificationsApi.list();
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/notifications?page=1&limit=50",
    );
  });
});

describe("notificationsApi unread views", () => {
  it("unread hits /notifications/unread", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [NOTIFICATION], total: 1, page: 1, total_pages: 1 }),
    );
    await notificationsApi.unread();
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/notifications/unread",
    );
  });

  it("unreadCount hits /notifications/unread/count and returns count", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ count: 3 }));
    const res = await notificationsApi.unreadCount();
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/notifications/unread/count",
    );
    expect(res.count).toBe(3);
  });
});

describe("notificationsApi mutations", () => {
  it("markRead POSTs /notifications/{id}/read", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await notificationsApi.markRead("notif-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/notifications/notif-1/read");
    expect((init as RequestInit).method).toBe("POST");
  });

  it("markAllRead POSTs /notifications/read-all (not under an id)", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(204));
    await notificationsApi.markAllRead();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/notifications/read-all");
    expect((init as RequestInit).method).toBe("POST");
  });
});
