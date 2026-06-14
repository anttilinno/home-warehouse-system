import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  del,
  downloadBlob,
  get,
  HttpError,
  patch,
  post,
  postMultipart,
  put,
  setRefreshToken,
} from "./api";

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

  // Phase 7 Plan 01 — invariant preservation: the existing helpers must keep
  // their signatures/behavior after put + downloadBlob are appended. These
  // re-assert get/patch/del still go through request() with the locked init,
  // and that HttpError(status) is still thrown on non-ok.
  it("get/patch/del still carry credentials:'include' and the /api prefix", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(emptyResponse(204));

    await get("/items");
    await patch("/items/1", { name: "x" });
    await del("/items/1");

    for (const [url, init] of fetchMock.mock.calls) {
      expect((url as string).startsWith("/api/")).toBe(true);
      expect(init).toMatchObject({ credentials: "include" });
    }
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("GET");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PATCH");
    expect((fetchMock.mock.calls[2][1] as RequestInit).method).toBe("DELETE");
  });

  it("still throws HttpError with the status on a non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ detail: "boom" }, 500),
    );
    await expect(get("/items")).rejects.toBeInstanceOf(HttpError);
  });
});

describe("api.ts put (additive)", () => {
  it("sends method PUT with a JSON body, Content-Type json, credentials include", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "p-1" }));

    const data = await put<{ id: string }>("/photos/p-1/caption", {
      caption: "hello",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/photos/p-1/caption");
    expect(init).toMatchObject({ method: "PUT", credentials: "include" });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
    expect(init.body).toBe(JSON.stringify({ caption: "hello" }));
    expect(data).toEqual({ id: "p-1" });
  });

  it("goes through the same 401 single-flight refresh + retry path as request()", async () => {
    setRefreshToken("good-refresh");
    fetchMock
      .mockResolvedValueOnce(emptyResponse(401)) // initial PUT 401
      .mockResolvedValueOnce(jsonResponse({ refresh_token: "rotated" })) // refresh ok
      .mockResolvedValueOnce(emptyResponse(204)); // retry ok

    await expect(put("/photos/p-1/primary", undefined)).resolves.toBeUndefined();
    // initial + refresh + retry = 3 fetches
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("api.ts downloadBlob (additive)", () => {
  it("fetches /api{endpoint} with credentials and triggers an anchor download", async () => {
    const blob = new Blob(["zipbytes"], { type: "application/zip" });
    fetchMock.mockResolvedValueOnce(
      new Response(blob, { status: 200 }),
    );
    const createObjectURL = vi
      .fn()
      .mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    const click = vi.fn();
    const anchor = { href: "", download: "", click } as unknown as HTMLAnchorElement;
    const createElement = vi
      .spyOn(document, "createElement")
      .mockReturnValue(anchor);

    await downloadBlob("/workspaces/ws-1/items/it-1/photos/download", "photos.zip");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/workspaces/ws-1/items/it-1/photos/download");
    expect(init).toMatchObject({ credentials: "include" });
    expect(anchor.download).toBe("photos.zip");
    expect(anchor.href).toBe("blob:mock");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");

    createElement.mockRestore();
  });

  it("throws HttpError(status) on a non-ok download", async () => {
    fetchMock.mockResolvedValueOnce(emptyResponse(403));
    await expect(
      downloadBlob("/workspaces/ws-1/export/item?format=csv", "x.csv"),
    ).rejects.toMatchObject({ status: 403 });
  });
});
