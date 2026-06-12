import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { getRefreshToken, setRefreshToken } from "@/lib/api";

// Phase 05 Plan 05 — AUTH-12 frontend half (Pattern 3). useLogout must POST
// /auth/logout (server-side revocation, guarded by Plan 01) and then ALWAYS
// (finally) clear the in-memory refresh token + localStorage["workspace_id"] +
// the TanStack cache and navigate to /login — EVEN when the POST throws. This
// proves logout is not navigate-only: a failed/expired logout still logs the
// user out client-side.

const navigateMock = vi.fn();
const clearMock = vi.fn();

vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ clear: clearMock }),
}));

// Import AFTER the mocks so the hook binds to the mocked router/query client.
const { useLogout } = await import("./useLogout");

const WS_KEY = "workspace_id";

beforeEach(() => {
  navigateMock.mockClear();
  clearMock.mockClear();
  localStorage.clear();
  localStorage.setItem(WS_KEY, "ws-A");
  setRefreshToken("a-refresh-token");
});

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
  setRefreshToken(null);
});

describe("useLogout (AUTH-12 frontend half)", () => {
  it("success path: POSTs /auth/logout then clears token + workspace + cache and navigates to /login", async () => {
    let logoutHit = false;
    server.use(
      http.post("/api/auth/logout", () => {
        logoutHit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useLogout());
    await result.current();

    expect(logoutHit).toBe(true);
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem(WS_KEY)).toBeNull();
    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
  });

  it("failure path (POST 500): client state STILL cleared and navigate fired (finally)", async () => {
    server.use(
      http.post("/api/auth/logout", () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useLogout());
    await result.current();

    // The POST threw, but the finally block ran: client logout is unconditional.
    expect(getRefreshToken()).toBeNull();
    expect(localStorage.getItem(WS_KEY)).toBeNull();
    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
  });
});
