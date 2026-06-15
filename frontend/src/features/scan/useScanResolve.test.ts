// useScanResolve — the single post-scan funnel (binding override 7 / RESEARCH
// Pattern 3). renderHook tests driving all 4 banner states off the MSW
// item-by-barcode handler, plus the render-loop guard (Pitfall 6 / Phase 65 D-22).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { useScanResolve } from "./useScanResolve";

// useWorkspace is the wsId source; mock it so we never need a provider.
const useWorkspaceMock = vi.fn();
vi.mock("@/features/workspace/useWorkspace", () => ({
  useWorkspace: () => useWorkspaceMock(),
}));

function setWsId(currentWorkspaceId: string | null) {
  useWorkspaceMock.mockReturnValue({
    currentWorkspaceId,
    setWorkspace: vi.fn(),
    workspaces: [],
    isLoading: false,
  });
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return { client, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  setWsId("ws-1");
});

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe("useScanResolve", () => {
  it("handleResolveCode is a no-op on empty code (no banner, no pause)", () => {
    const { wrapper } = makeWrapper();
    const feedback = vi.fn();
    const { result } = renderHook(() => useScanResolve({ feedback }), {
      wrapper,
    });

    act(() => {
      result.current.handleResolveCode("", "qr_code");
    });

    expect(result.current.banner).toBeNull();
    expect(result.current.paused).toBe(false);
    expect(feedback).not.toHaveBeenCalled();
  });

  it("drives LOADING → MATCH from one funnel, pauses, fires feedback, records history", async () => {
    const { wrapper } = makeWrapper();
    const feedback = vi.fn();
    const { result } = renderHook(() => useScanResolve({ feedback }), {
      wrapper,
    });

    act(() => {
      result.current.handleResolveCode("CODE-MATCH", "qr_code");
    });

    // Immediately: paused, banner set, feedback fired, history recorded.
    expect(result.current.paused).toBe(true);
    expect(result.current.banner).toEqual({
      code: "CODE-MATCH",
      format: "qr_code",
    });
    expect(feedback).toHaveBeenCalledTimes(1);

    const stored = JSON.parse(localStorage.getItem("hws-scan-history") || "[]");
    expect(stored[0].code).toBe("CODE-MATCH");

    // The query begins pending (LOADING) then settles success+Item (MATCH).
    await waitFor(() => expect(result.current.lookup.status).toBe("success"));
    expect(result.current.lookup.data).not.toBeNull();
    expect(result.current.lookup.data?.id).toBe("it-1");

    // History entry is refined to entityType=item with the resolved name.
    await waitFor(() => {
      const h = JSON.parse(localStorage.getItem("hws-scan-history") || "[]");
      expect(h[0].entityType).toBe("item");
      expect(h[0].entityName).toBe("Cordless Drill");
    });
  });

  it("maps a 404 to NOT-FOUND (success + null data) and unknown history", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items/by-barcode/:code", () =>
        HttpResponse.json({ message: "not found" }, { status: 404 }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useScanResolve({ feedback: vi.fn() }), {
      wrapper,
    });

    act(() => {
      result.current.handleResolveCode("CODE-MISS", "ean_13");
    });

    await waitFor(() => expect(result.current.lookup.status).toBe("success"));
    expect(result.current.lookup.data).toBeNull();

    await waitFor(() => {
      const h = JSON.parse(localStorage.getItem("hws-scan-history") || "[]");
      expect(h[0].entityType).toBe("unknown");
    });
  });

  it("maps a 500 to ERROR (lookup.status === 'error')", async () => {
    server.use(
      http.get("/api/workspaces/:wsId/items/by-barcode/:code", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useScanResolve({ feedback: vi.fn() }), {
      wrapper,
    });

    act(() => {
      result.current.handleResolveCode("CODE-ERR", "code_128");
    });

    await waitFor(() => expect(result.current.lookup.status).toBe("error"));
  });

  it("resume() clears the banner and unpauses (Back to Scan)", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useScanResolve({ feedback: vi.fn() }), {
      wrapper,
    });

    act(() => {
      result.current.handleResolveCode("CODE-MATCH", "qr_code");
    });
    await waitFor(() => expect(result.current.lookup.status).toBe("success"));

    act(() => {
      result.current.resume();
    });

    expect(result.current.banner).toBeNull();
    expect(result.current.paused).toBe(false);
  });

  it("re-resolving the SAME code re-fires the lookup (history re-tap = fresh scan)", async () => {
    let calls = 0;
    server.use(
      http.get("/api/workspaces/:wsId/items/by-barcode/:code", ({ params }) => {
        calls += 1;
        return HttpResponse.json({
          id: "it-1",
          workspace_id: "ws-1",
          name: "Cordless Drill",
          sku: "SKU-1",
          min_stock_level: 0,
          is_archived: false,
          barcode: String(params.code),
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        });
      }),
    );
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useScanResolve({ feedback: vi.fn() }), {
      wrapper,
    });

    act(() => {
      result.current.handleResolveCode("SAME", "qr_code");
    });
    await waitFor(() => expect(result.current.lookup.status).toBe("success"));
    expect(calls).toBe(1);

    // resume, then re-resolve the same code (e.g. history re-tap).
    act(() => {
      result.current.resume();
    });
    act(() => {
      result.current.handleResolveCode("SAME", "qr_code");
    });
    await waitFor(() => expect(calls).toBe(2));
  });

  it("does not enter an infinite render loop (bounded render count)", async () => {
    const { wrapper } = makeWrapper();
    let renders = 0;
    const { result } = renderHook(
      () => {
        renders += 1;
        return useScanResolve({ feedback: vi.fn() });
      },
      { wrapper },
    );

    act(() => {
      result.current.handleResolveCode("CODE-MATCH", "qr_code");
    });
    await waitFor(() => expect(result.current.lookup.status).toBe("success"));

    // Give any errant effect a chance to re-fire; assert the count stays bounded.
    const settled = renders;
    await new Promise((r) => setTimeout(r, 50));
    expect(renders - settled).toBeLessThanOrEqual(1);
    expect(renders).toBeLessThan(15);
  });
});
