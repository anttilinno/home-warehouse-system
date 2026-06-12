import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get, post, postMultipart, setRefreshToken } from "./api";

// Phase 05 Plan 02 — proves the api.ts auth-expired contract and the four
// locked invariants. We stub `fetch` directly (not MSW) so we can assert the
// exact init each call receives and count how many times doRefresh runs under
// concurrency. Every case resets the in-memory refresh token for determinism.

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function emptyResponse(status: number): Response {
  return new Response(null, { status });
}

let fetchMock: FetchMock;
let authExpiredCount: number;
const onAuthExpired = () => {
  authExpiredCount += 1;
};

beforeEach(() => {
  setRefreshToken(null);
  authExpiredCount = 0;
  window.addEventListener("auth-expired", onAuthExpired);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  window.removeEventListener("auth-expired", onAuthExpired);
  setRefreshToken(null);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api.ts auth-expired event", () => {
  it("fires auth-expired exactly once when refresh fails (no stored token)", async () => {
    // First request 401s; doRefresh has no stored token → immediate failure.
    fetchMock.mockResolvedValueOnce(emptyResponse(401));

    await expect(get("/users/me/workspaces")).rejects.toMatchObject({
      status: 401,
    });
    expect(authExpiredCount).toBe(1);
  });

  it("fires auth-expired once when the refresh endpoint itself returns !ok", async () => {
    setRefreshToken("stale-refresh");
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401)) // initial request
      .mockResolvedValueOnce(emptyResponse(401)); // /auth/refresh fails

    await expect(get("/users/me/workspaces")).rejects.toMatchObject({
      status: 401,
    });
    expect(authExpiredCount).toBe(1);
  });

  it("shares one doRefresh and fires one auth-expired for two concurrent 401s", async () => {
    setRefreshToken("stale-refresh");
    let refreshCalls = 0;
    fetchMock.mockImplementation((url: string) => {
      if (typeof url === "string" && url.endsWith("/auth/refresh")) {
        refreshCalls += 1;
        return Promise.resolve(emptyResponse(401));
      }
      // Both initial requests 401 to trigger the single-flight refresh.
      return Promise.resolve(emptyResponse(401));
    });

    const results = await Promise.allSettled([
      get("/users/me/workspaces"),
      get("/users/me/sessions"),
    ]);

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshCalls).toBe(1); // single-flight invariant
    expect(authExpiredCount).toBe(1); // one event, not two
  });

  it("fires zero auth-expired and returns payload on a successful refresh + retry", async () => {
    setRefreshToken("good-refresh");
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401)) // initial 401
      .mockResolvedValueOnce(
        jsonResponse({ refresh_token: "rotated" }), // /auth/refresh ok
      )
      .mockResolvedValueOnce(jsonResponse([{ id: "ws-1" }])); // retry ok

    const data = await get<Array<{ id: string }>>("/users/me/workspaces");

    expect(data).toEqual([{ id: "ws-1" }]);
    expect(authExpiredCount).toBe(0);
  });
});

describe("api.ts locked invariants", () => {
  it("sends credentials:'include' on every fetch and BASE_URL '/api' prefix", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await get("/users/me");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/users/me");
    expect(init).toMatchObject({ credentials: "include" });
  });

  it("omits Content-Type for FormData bodies (browser supplies boundary)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const form = new FormData();
    form.append("file", new Blob(["x"]), "x.txt");

    await postMultipart("/items", form);

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
    expect(init).toMatchObject({ credentials: "include" });
  });

  it("sets Content-Type application/json for JSON bodies", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    await post("/auth/login", { email: "a@b.c", password: "x" });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });
});
