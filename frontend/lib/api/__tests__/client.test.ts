import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { apiClient } from "../client";

function mockFetchResponse(
  data: any,
  opts: { ok?: boolean; status?: number; contentType?: string } = {}
) {
  const { ok = true, status = 200, contentType = "application/json" } = opts;
  const headers = new Headers();
  if (contentType) headers.set("content-type", contentType);
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers,
    json: vi.fn().mockResolvedValueOnce(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  apiClient.setToken(null);
});

describe("ApiClient", () => {
  describe("HTTP methods", () => {
    it("sends GET request with correct URL and headers", async () => {
      mockFetchResponse({ result: "ok" });

      await apiClient.get("/test");

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/test", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    });

    it("sends POST request with JSON body", async () => {
      mockFetchResponse({ result: "ok" });

      await apiClient.post("/test", { a: 1 });

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ a: 1 }),
      });
    });

    it("sends PATCH request with JSON body", async () => {
      mockFetchResponse({ result: "ok" });

      await apiClient.patch("/test", { a: 1 });

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/test", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ a: 1 }),
      });
    });

    it("sends DELETE request", async () => {
      mockFetchResponse({ result: "ok" });

      await apiClient.delete("/test");

      expect(mockFetch).toHaveBeenCalledWith("http://localhost:8000/test", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    });
  });

  describe("authentication", () => {
    it("includes Authorization header when token is set", async () => {
      apiClient.setToken("tok");
      mockFetchResponse({ result: "ok" });

      await apiClient.get("/test");

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders["Authorization"]).toBe("Bearer tok");
    });

    it("includes X-Workspace-ID header when workspaceId is provided", async () => {
      mockFetchResponse({ result: "ok" });

      await apiClient.get("/test", "ws-1");

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders["X-Workspace-ID"]).toBe("ws-1");
    });
  });

  describe("error handling", () => {
    it("clears token and redirects to /login on 401 response", async () => {
      apiClient.setToken("old-token");
      const originalLocation = window.location;
      // @ts-expect-error - mocking window.location
      delete window.location;
      window.location = { href: "" } as any;

      mockFetchResponse(null, { ok: false, status: 401 });

      await expect(apiClient.get("/test")).rejects.toThrow(
        "Session expired. Please log in again."
      );
      expect(apiClient.getToken()).toBeNull();
      expect(window.location.href).toBe("/login");

      window.location = originalLocation as unknown as (string & Location);
    });

    it("throws error with message from response body on non-401 error", async () => {
      const headers = new Headers();
      headers.set("content-type", "application/json");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers,
        json: vi.fn().mockResolvedValueOnce({ message: "Bad request" }),
      });

      await expect(apiClient.get("/test")).rejects.toThrow("Bad request");
    });

    it("throws with HTTP status text when json parsing fails", async () => {
      const headers = new Headers();
      headers.set("content-type", "application/json");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers,
        json: vi.fn().mockRejectedValueOnce(new Error("parse error")),
      });

      await expect(apiClient.get("/test")).rejects.toThrow(
        "HTTP 500: Internal Server Error"
      );
    });
  });

  describe("response parsing", () => {
    it("returns undefined for 204 No Content without content-type", async () => {
      const headers = new Headers();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: "No Content",
        headers,
        json: vi.fn(),
      });

      const result = await apiClient.get("/test");

      expect(result).toBeUndefined();
    });
  });

  describe("postForm", () => {
    it("sends FormData without Content-Type header", async () => {
      const formData = new FormData();
      formData.append("file", "content");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValueOnce({ uploaded: true }),
      });

      await apiClient.postForm("/upload", formData);

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers["Content-Type"]).toBeUndefined();
      expect(options.body).toBe(formData);
    });
  });

  describe("withStatus methods", () => {
    it("postWithStatus returns data and status", async () => {
      mockFetchResponse({ id: "1" });

      const result = await apiClient.postWithStatus("/test", { a: 1 });

      expect(result).toEqual({ data: { id: "1" }, status: 200 });
    });

    it("patchWithStatus returns data and status", async () => {
      mockFetchResponse({ id: "1" });

      const result = await apiClient.patchWithStatus("/test", { a: 1 });

      expect(result).toEqual({ data: { id: "1" }, status: 200 });
    });

    it("deleteWithStatus returns undefined data and status", async () => {
      const headers = new Headers();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        statusText: "No Content",
        headers,
        json: vi.fn(),
      });

      const result = await apiClient.deleteWithStatus("/test");

      expect(result).toEqual({ data: undefined, status: 204 });
    });
  });

  describe("token persistence", () => {
    it("persists token to localStorage via setToken and retrieves via getToken", () => {
      apiClient.setToken("my-token");

      expect(apiClient.getToken()).toBe("my-token");
      expect(localStorage.getItem("auth_token")).toBe("my-token");

      apiClient.setToken(null);

      expect(apiClient.getToken()).toBeNull();
      expect(localStorage.getItem("auth_token")).toBeNull();
    });
  });
});
