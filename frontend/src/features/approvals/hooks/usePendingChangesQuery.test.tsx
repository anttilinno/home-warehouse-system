import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { usePendingChangesQuery } from "./usePendingChangesQuery";

// DASH-03 side-rail read. Mirrors useApprovalsList.test.tsx's 403 silent-degrade
// coverage but for THIS hook's distinct key suffix (opts?.status ?? "all" vs
// useApprovalsList's hardcoded "pending") and its `total`-only surface.

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

function makeHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("usePendingChangesQuery", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("fetches total with NO status filter by default", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe(null);
        return HttpResponse.json({ changes: [], total: 3 });
      }),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => usePendingChangesQuery(), { wrapper });

    await waitFor(() => expect(result.current.total).toBe(3));
    expect(result.current.isForbidden).toBe(false);
  });

  it("passes an explicit status through to the querystring", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe(
          "approved",
        );
        return HttpResponse.json({ changes: [], total: 1 });
      }),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(
      () => usePendingChangesQuery({ status: "approved" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.total).toBe(1));
  });

  it("is disabled with NO workspace — no request fires, total stays 0", async () => {
    setWsId(null);
    let hit = false;
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", () => {
        hit = true;
        return HttpResponse.json({ changes: [], total: 0 });
      }),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => usePendingChangesQuery(), { wrapper });

    await new Promise((r) => setTimeout(r, 30));
    expect(hit).toBe(false);
    expect(result.current.total).toBe(0);
    expect(result.current.isLoading).toBe(false);
  });

  it("a 403 settles with isForbidden===true, total stays 0, and does NOT retry", async () => {
    setWsId("ws-A");
    let calls = 0;
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", () => {
        calls += 1;
        return HttpResponse.json({ message: "forbidden" }, { status: 403 });
      }),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => usePendingChangesQuery(), { wrapper });

    await waitFor(() => expect(result.current.isForbidden).toBe(true));
    expect(calls).toBe(1);
    expect(result.current.total).toBe(0);
  });

  it("keys ['pending-changes', wsId, status] distinctly per status (no cache collision)", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    client.setQueryData(["pending-changes", "ws-A", "all"], {
      changes: [],
      total: 9,
    });
    client.setQueryData(["pending-changes", "ws-A", "approved"], {
      changes: [],
      total: 2,
    });
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", () =>
        HttpResponse.json({ changes: [], total: 0 }),
      ),
    );

    const { result: allResult } = renderHook(() => usePendingChangesQuery(), {
      wrapper,
    });
    const { result: approvedResult } = renderHook(
      () => usePendingChangesQuery({ status: "approved" }),
      { wrapper },
    );

    expect(allResult.current.total).toBe(9);
    expect(approvedResult.current.total).toBe(2);
  });
});
