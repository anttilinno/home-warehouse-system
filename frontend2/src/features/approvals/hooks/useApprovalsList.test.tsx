import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useApprovalsList } from "./useApprovalsList";
import { useApproveChange } from "./useApprovalMutations";

// SYS-01 (Phase 14 Plan 01) — the approvals list read + the per-id review
// mutations. Mirrors usePendingChangesQuery's 403 silent-degrade discipline:
// retry:false + isForbidden derived from HttpError.status===403.

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

function pendingRow(id: string) {
  return {
    id,
    workspace_id: "ws-A",
    requester_id: "u-1",
    requester_name: "Alex",
    requester_email: "alex@test.local",
    entity_type: "item",
    entity_id: "item-9",
    action: "update",
    status: "pending",
    created_at: "2026-06-13T10:00:00Z",
  };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useApprovalsList / useApprovalMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("fetches pending rows + total when a workspace is selected", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", ({ request }) => {
        expect(new URL(request.url).searchParams.get("status")).toBe("pending");
        return HttpResponse.json({ changes: [pendingRow("pc-1")], total: 1 });
      }),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useApprovalsList(), { wrapper });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].requester_name).toBe("Alex");
    expect(result.current.total).toBe(1);
    expect(result.current.isForbidden).toBe(false);
  });

  it("is disabled with NO workspace — no request fires", async () => {
    setWsId(null);
    let hit = false;
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", () => {
        hit = true;
        return HttpResponse.json({ changes: [], total: 0 });
      }),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useApprovalsList(), { wrapper });

    // Give the query a tick; with enabled:false it must never fetch.
    await new Promise((r) => setTimeout(r, 30));
    expect(hit).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("a 403 settles with isForbidden===true and does NOT retry", async () => {
    setWsId("ws-A");
    let calls = 0;
    server.use(
      http.get("/api/workspaces/:ws/pending-changes", () => {
        calls += 1;
        return HttpResponse.json({ message: "forbidden" }, { status: 403 });
      }),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useApprovalsList(), { wrapper });

    await waitFor(() => expect(result.current.isForbidden).toBe(true));
    // retry:false → exactly one request, no backoff storm.
    expect(calls).toBe(1);
    expect(result.current.rows).toEqual([]);
  });

  it("useApproveChange().mutateAsync(id) POSTs approve and resolves", async () => {
    setWsId("ws-A");
    let approved = "";
    server.use(
      http.post(
        "/api/workspaces/:ws/pending-changes/:id/approve",
        ({ params }) => {
          approved = String(params.id);
          return HttpResponse.json({ ...pendingRow("pc-1"), status: "approved" });
        },
      ),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useApproveChange(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("pc-1");
    });

    expect(approved).toBe("pc-1");
  });

  it("useRejectChange().mutateAsync({id, reason}) POSTs reject with the reason", async () => {
    setWsId("ws-A");
    let body: unknown = null;
    server.use(
      http.post(
        "/api/workspaces/:ws/pending-changes/:id/reject",
        async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ ...pendingRow("pc-1"), status: "rejected" });
        },
      ),
    );
    const { wrapper } = makeHarness();

    const { useRejectChange } = await import("./useApprovalMutations");
    const { result } = renderHook(() => useRejectChange(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "pc-1", reason: "dup" });
    });

    expect(body).toEqual({ reason: "dup" });
  });
});
