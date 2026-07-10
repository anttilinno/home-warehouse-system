import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { paperlessApi } from "./paperless";

// Phase 4 Plan 01 (test-gaps 4.1) — paperlessApi unit tests. Stubs global.fetch
// (canonical fetch-mock pattern, mirroring loans.test.ts) to assert URL/payload
// shape for settings CRUD, search query-param building, and resolve.

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

const SETTINGS = {
  configured: true,
  base_url: "https://paperless.example.com",
  is_enabled: true,
  sync_tags_enabled: false,
  has_token: true,
};

describe("paperlessApi settings", () => {
  it("getSettings fetches /paperless/settings", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SETTINGS));
    await paperlessApi.getSettings("ws-1");
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/paperless/settings",
    );
  });

  it("saveSettings PUTs /paperless/settings with body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(SETTINGS));
    const body = {
      base_url: "https://paperless.example.com",
      is_enabled: true,
      sync_tags_enabled: false,
    };
    await paperlessApi.saveSettings("ws-1", body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/paperless/settings");
    expect((init as RequestInit).method).toBe("PUT");
    expect((init as RequestInit).body).toBe(JSON.stringify(body));
  });

  it("deleteSettings DELETEs /paperless/settings", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await paperlessApi.deleteSettings("ws-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/workspaces/ws-1/paperless/settings");
    expect((init as RequestInit).method).toBe("DELETE");
  });
});

describe("paperlessApi search", () => {
  it("builds ?query= with page and page_size when given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ count: 0, results: [] }));
    await paperlessApi.search("ws-1", "invoice", 2, 25);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/workspaces/ws-1/paperless/search?");
    expect(url).toContain("query=invoice");
    expect(url).toContain("page=2");
    expect(url).toContain("page_size=25");
  });

  it("omits page and page_size when not given", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ count: 0, results: [] }));
    await paperlessApi.search("ws-1", "invoice");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("query=invoice");
    expect(url).not.toContain("page=");
    expect(url).not.toContain("page_size=");
  });
});

describe("paperlessApi.resolve", () => {
  it("fetches /paperless/documents/{id}", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: 42,
        title: "doc",
        download_url: "/x",
        preview_url: "/y",
        web_url: "/z",
      }),
    );
    await paperlessApi.resolve("ws-1", 42);
    expect(fetchMock.mock.calls[0][0] as string).toContain(
      "/workspaces/ws-1/paperless/documents/42",
    );
  });
});
