import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useWishlistMutations } from "./useWishlistMutations";

// Phase 4 Plan Test-Gaps 4.3 — dedicated mutation coverage (useWishlist.test.tsx
// only exercises `create`). Mirrors useNotificationMutations.test.tsx: each
// mutation must invalidate the ["wishlist", wsId] PREFIX (default exact:false)
// per the hook's block comment.

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

const WANTED = {
  id: "w-1",
  name: "Cordless Drill",
  priority: 3,
  status: "wanted" as const,
  created_at: "2026-06-13T00:00:00Z",
};

function makeHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useWishlistMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("update().mutate PATCHes /wishlist/:id and invalidates the [wishlist, wsId] prefix", async () => {
    setWsId("ws-1");
    let sentBody: unknown;
    server.use(
      http.patch("/api/workspaces/:ws/wishlist/:id", async ({ request }) => {
        sentBody = await request.json();
        return HttpResponse.json({ ...WANTED, status: "ordered" });
      }),
    );
    const { client, wrapper } = makeHarness();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useWishlistMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "w-1",
        body: { status: "ordered" },
      });
    });

    expect(sentBody).toEqual({ status: "ordered" });
    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["wishlist", "ws-1"],
      }),
    );
  });

  it("remove().mutate DELETEs /wishlist/:id and invalidates the [wishlist, wsId] prefix", async () => {
    setWsId("ws-1");
    server.use(
      http.delete(
        "/api/workspaces/:ws/wishlist/:id",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    const { client, wrapper } = makeHarness();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useWishlistMutations(), { wrapper });
    await act(async () => {
      await result.current.remove.mutateAsync("w-1");
    });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["wishlist", "ws-1"],
      }),
    );
  });

  it("surfaces the 409 ErrInvalidStatusTransition unswallowed on update", async () => {
    setWsId("ws-1");
    server.use(
      http.patch("/api/workspaces/:ws/wishlist/:id", () =>
        HttpResponse.json(
          { message: "invalid status transition" },
          { status: 409 },
        ),
      ),
    );
    const { wrapper } = makeHarness();

    const { result } = renderHook(() => useWishlistMutations(), { wrapper });
    await act(async () => {
      await result.current.update
        .mutateAsync({ id: "w-1", body: { status: "acquired" } })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.update.isError).toBe(true));
  });
});
