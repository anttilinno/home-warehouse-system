import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useApproveChange, useRejectChange } from "./useApprovalMutations";

// SYS-01 (Phase 14 Plan 01). Unlike useLoanMutations/useInventoryMutations,
// these have NO onMutate/onSettled at all — there is no bulk endpoint, so the
// /approvals page batches ids through Promise.allSettled and invalidates the
// ["pending-changes", wsId] prefix ONCE itself after the batch settles. The
// regression this guards: the hook must stay invalidation-free, otherwise a
// per-id invalidate would refetch N times during a bulk review.

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

describe("useApprovalMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("useApproveChange never calls invalidateQueries itself (page owns the batch invalidate)", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.post("/api/workspaces/:ws/pending-changes/:id/approve", () =>
        HttpResponse.json({ id: "pc-1", status: "approved" }),
      ),
    );

    const { result } = renderHook(() => useApproveChange(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync("pc-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });

  it("useRejectChange never calls invalidateQueries itself", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.post("/api/workspaces/:ws/pending-changes/:id/reject", () =>
        HttpResponse.json({ id: "pc-1", status: "rejected" }),
      ),
    );

    const { result } = renderHook(() => useRejectChange(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "pc-1", reason: "dup" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).not.toHaveBeenCalled();
  });

  it("useApproveChange surfaces a rejected mutateAsync on a 4xx (no swallow)", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:ws/pending-changes/:id/approve", () =>
        HttpResponse.json({ message: "already reviewed" }, { status: 400 }),
      ),
    );

    const { result } = renderHook(() => useApproveChange(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync("pc-1")).rejects.toThrow();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
