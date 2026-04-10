import { describe, it, expect, vi, beforeEach } from "vitest";
import { get, post, del, setRefreshToken } from "../api";

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(data),
  } as Response;
}

function emptyResponse(status = 204) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "No Content",
    headers: new Headers(),
    json: () => Promise.reject(new Error("No JSON")),
  } as Response;
}

function errorResponse(status = 401, body?: unknown) {
  return {
    ok: false,
    status,
    statusText: "Unauthorized",
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body ?? { detail: "Unauthorized" }),
  } as Response;
}

describe("API client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    setRefreshToken(null);
  });

  it("get() calls fetch with correct URL prefix, method, credentials, and Content-Type", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1", email: "a@b.c" }));

    const result = await get("/users/me");

    expect(mockFetch).toHaveBeenCalledWith("/api/users/me", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    expect(result).toEqual({ id: "1", email: "a@b.c" });
  });

  it("post() sends JSON body with credentials: include", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ token: "t", refresh_token: "rt" })
    );

    const result = await post("/auth/login", {
      email: "a@b.c",
      password: "pass",
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email: "a@b.c", password: "pass" }),
    });
    expect(result).toEqual({ token: "t", refresh_token: "rt" });
  });

  it("on 401, calls POST /api/auth/refresh then retries original request", async () => {
    setRefreshToken("old-rt");

    // First call: 401
    mockFetch.mockResolvedValueOnce(errorResponse(401));
    // Refresh call: success
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ token: "new-t", refresh_token: "new-rt" })
    );
    // Retry original: success
    mockFetch.mockResolvedValueOnce(jsonResponse({ id: "1" }));

    const result = await get("/users/me");

    expect(mockFetch).toHaveBeenCalledTimes(3);
    // Second call should be refresh
    expect(mockFetch.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(mockFetch.mock.calls[1][1]).toMatchObject({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ refresh_token: "old-rt" }),
    });
    expect(result).toEqual({ id: "1" });
  });

  it("concurrent 401s deduplicate into a single refresh call", async () => {
    setRefreshToken("rt");

    // Both initial calls return 401
    mockFetch.mockResolvedValueOnce(errorResponse(401));
    mockFetch.mockResolvedValueOnce(errorResponse(401));
    // Single refresh call
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ token: "t", refresh_token: "rt2" })
    );
    // Two retries
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: "a" }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: "b" }));

    const [r1, r2] = await Promise.all([get("/path1"), get("/path2")]);

    // 2 original + 1 refresh + 2 retries = 5
    expect(mockFetch).toHaveBeenCalledTimes(5);
    // Only one refresh call
    const refreshCalls = mockFetch.mock.calls.filter(
      (c) => c[0] === "/api/auth/refresh"
    );
    expect(refreshCalls).toHaveLength(1);
    expect(r1).toEqual({ data: "a" });
    expect(r2).toEqual({ data: "b" });
  });

  it("throws 'Session expired' if refresh also fails", async () => {
    setRefreshToken("rt");

    mockFetch.mockResolvedValueOnce(errorResponse(401));
    mockFetch.mockResolvedValueOnce(errorResponse(401));

    await expect(get("/users/me")).rejects.toThrow("Session expired");
  });

  it("del() sends DELETE method", async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse(204));

    await del("/some/path");

    expect(mockFetch).toHaveBeenCalledWith("/api/some/path", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
  });

  it("204 response with no content-type returns undefined", async () => {
    mockFetch.mockResolvedValueOnce(emptyResponse(204));

    const result = await get("/some/path");

    expect(result).toBeUndefined();
  });
});
