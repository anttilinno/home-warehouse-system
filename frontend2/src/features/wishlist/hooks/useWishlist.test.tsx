import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useWishlist } from "./useWishlist";
import { useWishlistMutations } from "./useWishlistMutations";

// Phase 14 Plan 03 Task 1 — list/mutation hook tests. useWorkspace is mocked
// (mirrors LoansListPage.test). MSW backs /api/workspaces/:ws/wishlist*. The
// list query is keyed ["wishlist", wsId, status]; the create mutation
// invalidates the ["wishlist", wsId] prefix.

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

function wrapperWith(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function freshClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useWishlist", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("fetches the wanted list when a workspace is selected", async () => {
    setWsId("ws-1");
    server.use(
      http.get("/api/workspaces/:ws/wishlist", ({ request }) => {
        const status = new URL(request.url).searchParams.get("status");
        expect(status).toBe("wanted");
        return HttpResponse.json({ items: [WANTED], total: 1 });
      }),
    );

    const { result } = renderHook(() => useWishlist("wanted"), {
      wrapper: wrapperWith(freshClient()),
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].name).toBe("Cordless Drill");
    expect(result.current.total).toBe(1);
  });

  it("is disabled (never fetches) without a workspace", async () => {
    setWsId(null);
    const spy = vi.fn(() => HttpResponse.json({ items: [], total: 0 }));
    server.use(http.get("/api/workspaces/:ws/wishlist", spy));

    const { result } = renderHook(() => useWishlist("wanted"), {
      wrapper: wrapperWith(freshClient()),
    });

    // The query is disabled — it stays in the idle/loading-without-fetch state
    // and the handler is never hit.
    expect(result.current.rows).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("useWishlistMutations", () => {
  it("create().mutate invalidates the [wishlist, wsId] prefix", async () => {
    setWsId("ws-1");
    server.use(
      http.post("/api/workspaces/:ws/wishlist", () =>
        HttpResponse.json({ ...WANTED, id: "w-new" }),
      ),
    );
    const client = freshClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useWishlistMutations(), {
      wrapper: wrapperWith(client),
    });

    await result.current.create.mutateAsync({ name: "Cordless Drill" });

    await waitFor(() =>
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["wishlist", "ws-1"],
      }),
    );
  });
});
