import { describe, it, expect, vi, beforeEach } from "vitest";
import { postMultipart, setRefreshToken } from "@/lib/api";

// Helper to create a mock Response
function makeResponse(
  status: number,
  body: unknown,
  contentType = "application/json"
): Response {
  const bodyStr = body !== undefined ? JSON.stringify(body) : "";
  return new Response(bodyStr, {
    status,
    headers: { "Content-Type": contentType },
  });
}

describe("postMultipart and FormData-aware request()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRefreshToken(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("Test 1: FormData body must NOT include Content-Type header (lets browser set multipart boundary)", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: "photo-1" }));

    const form = new FormData();
    form.append("file", new Blob(["data"], { type: "image/jpeg" }), "photo.jpg");

    await postMultipart<{ id: string }>("/items/1/photos", form);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;

    // The Content-Type must NOT be present so the browser can set the multipart boundary
    expect(headers).not.toHaveProperty("Content-Type");
    expect(headers["Content-Type"]).toBeUndefined();
  });

  it("Test 2: Non-FormData body preserves Content-Type: application/json (no regression)", async () => {
    // We test request() indirectly via the existing post() helper
    const { post } = await import("@/lib/api");
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(makeResponse(200, { ok: true }));

    await post<{ ok: boolean }>("/items", { name: "Test" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];
    const headers = (options as RequestInit).headers as Record<string, string>;

    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("Test 3: postMultipart<T> calls fetch with method POST, body === form, and credentials: include", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(makeResponse(201, { id: "photo-2" }));

    const form = new FormData();
    form.append("file", new Blob(["data"], { type: "image/png" }), "img.png");

    const result = await postMultipart<{ id: string }>("/workspaces/ws1/items/i1/photos", form);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toBe("/api/workspaces/ws1/items/i1/photos");
    expect((options as RequestInit).method).toBe("POST");
    expect((options as RequestInit).body).toBe(form);
    expect((options as RequestInit).credentials).toBe("include");
    expect(result).toEqual({ id: "photo-2" });
  });

  it("Test 4: 401 on multipart POST triggers the refresh-retry path exactly once", async () => {
    setRefreshToken("old");
    const mockFetch = vi.mocked(fetch);

    // First call: original request returns 401
    mockFetch.mockResolvedValueOnce(makeResponse(401, { detail: "expired" }));
    // Second call: refresh endpoint returns 200 with new refresh token
    mockFetch.mockResolvedValueOnce(makeResponse(200, { refresh_token: "new" }));
    // Third call: retry of original request returns 200 with data
    mockFetch.mockResolvedValueOnce(makeResponse(200, { ok: true }));

    const form = new FormData();
    form.append("file", new Blob(["data"]), "file.jpg");

    const result = await postMultipart<{ ok: boolean }>("/items/1/photos", form);

    // Two fetch calls: original 401, then refresh (not counting retry as #2 — total 3)
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify refresh was called between the two request attempts
    const [refreshUrl] = mockFetch.mock.calls[1];
    expect(refreshUrl as string).toBe("/api/auth/refresh");

    // Verify refresh was called exactly once
    const refreshCalls = mockFetch.mock.calls.filter(([url]) =>
      (url as string).includes("/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(1);

    expect(result).toEqual({ ok: true });
  });
});
