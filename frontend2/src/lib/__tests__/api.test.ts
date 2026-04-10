import { describe, it, expect, vi, beforeEach } from "vitest";
import { get, post, patch, del, setRefreshToken, getRefreshToken } from "@/lib/api";

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

describe("API client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRefreshToken(null);
    vi.stubGlobal("fetch", vi.fn());
  });

  it("get() makes GET request with credentials: include", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: "u1" }));

    const result = await get<{ id: string }>("/users/me");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/users/me");
    expect(options).toMatchObject({
      method: "GET",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    expect(result).toEqual({ id: "u1" });
  });

  it("post() makes POST request with JSON body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { token: "t", refresh_token: "rt" })
    );

    const result = await post<{ token: string; refresh_token: string }>(
      "/auth/login",
      { email: "a@b.com", password: "p" }
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/auth/login");
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ email: "a@b.com", password: "p" }),
    });
    expect(result).toEqual({ token: "t", refresh_token: "rt" });
  });

  it("request throws on non-200 non-401 response", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      makeResponse(500, { detail: "Internal error" })
    );

    await expect(get("/fail")).rejects.toThrow("Internal error");
  });

  it("401 triggers refresh then retries original request", async () => {
    setRefreshToken("rt1");
    const mockFetch = vi.mocked(fetch);

    // First call: 401
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
    // Second call: refresh succeeds
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { token: "t2", refresh_token: "rt2" })
    );
    // Third call: retry succeeds
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: "u1" }));

    const result = await get<{ id: string }>("/users/me");

    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Verify refresh call sent the correct refresh token
    const [refreshUrl, refreshOptions] = mockFetch.mock.calls[1];
    expect(refreshUrl).toBe("/api/auth/refresh");
    expect(refreshOptions).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ refresh_token: "rt1" }),
    });

    expect(result).toEqual({ id: "u1" });
    expect(getRefreshToken()).toBe("rt2");
  });

  it("concurrent 401s deduplicate refresh", async () => {
    setRefreshToken("rt1");
    const mockFetch = vi.mocked(fetch);

    // First two calls: 401 (concurrent requests to /a and /b)
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
    // Refresh call: 200
    mockFetch.mockResolvedValueOnce(
      makeResponse(200, { token: "t2", refresh_token: "rt2" })
    );
    // Retry for /a: 200
    mockFetch.mockResolvedValueOnce(makeResponse(200, { name: "a" }));
    // Retry for /b: 200
    mockFetch.mockResolvedValueOnce(makeResponse(200, { name: "b" }));

    const [resultA, resultB] = await Promise.all([
      get<{ name: string }>("/a"),
      get<{ name: string }>("/b"),
    ]);

    // Count how many times refresh endpoint was called
    const refreshCalls = mockFetch.mock.calls.filter(([url]) =>
      (url as string).includes("/auth/refresh")
    );
    expect(refreshCalls).toHaveLength(1);
    expect(resultA).toEqual({ name: "a" });
    expect(resultB).toEqual({ name: "b" });
  });

  it("refresh failure throws 'Session expired'", async () => {
    setRefreshToken("rt1");
    const mockFetch = vi.mocked(fetch);

    // First call: 401
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}));
    // Refresh call: 401 (refresh token expired)
    mockFetch.mockResolvedValueOnce(makeResponse(401, {}));

    await expect(get("/fail")).rejects.toThrow("Session expired");
  });

  it("handles 204 No Content responses", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 204,
        headers: { "Content-Type": "text/plain" },
      })
    );

    const result = await post("/auth/logout");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it("patch() makes PATCH request with JSON body", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(makeResponse(200, { id: "u1", email: "new@b.com" }));

    const result = await patch<{ id: string; email: string }>("/users/me", {
      email: "new@b.com",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/users/me");
    expect(options).toMatchObject({
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify({ email: "new@b.com" }),
    });
    expect(result).toEqual({ id: "u1", email: "new@b.com" });
  });

  it("del() makes DELETE request", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 204,
        headers: { "Content-Type": "text/plain" },
      })
    );

    await del("/items/123");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/items/123");
    expect(options).toMatchObject({
      method: "DELETE",
      credentials: "include",
    });
  });
});
