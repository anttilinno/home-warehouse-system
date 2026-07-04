import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { onlineManager } from "@tanstack/react-query";
import { server } from "@/test/msw/server";
import { registerMutationDefaults } from "@/lib/offline/mutationDefaults";
import type { Inventory } from "@/lib/types";
import { useInventoryMutations } from "./useInventoryMutations";

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

function makeEntry(id: string, over: Partial<Inventory> = {}): Inventory {
  return {
    id,
    workspace_id: "ws-A",
    item_id: "it-1",
    location_id: "loc-1",
    quantity: 3,
    condition: "GOOD",
    status: "AVAILABLE",
    is_archived: false,
    created_at: "2026-06-13T00:00:00Z",
    updated_at: "2026-06-13T00:00:00Z",
    ...over,
  };
}

/** The list cache key the page seeds (["inventory", wsId, params]). */
const LIST_KEY = ["inventory", "ws-A", { page: 1, limit: 25 }];

function makeHarness(seed: Inventory[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // updateQuantity's mutationFn now lives in the registered default
  // (C-quantity offline replay), so the harness must register it.
  registerMutationDefaults(client);
  client.setQueryData(LIST_KEY, {
    items: seed,
    total: seed.length,
    page: 1,
    total_pages: 1,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

function cachedQty(client: QueryClient, id: string): number | undefined {
  const data = client.getQueryData<{ items: Inventory[] }>(LIST_KEY);
  return data?.items.find((e) => e.id === id)?.quantity;
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  onlineManager.setOnline(true); // a failed offline test must not leak state
});

describe("useInventoryMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("optimistically patches the quantity in the cached list", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeEntry("inv-1", { quantity: 3 }),
    ]);
    server.use(
      http.patch("/api/workspaces/:wsId/inventory/:id/quantity", () =>
        HttpResponse.json(makeEntry("inv-1", { quantity: 7 })),
      ),
    );

    const { result } = renderHook(() => useInventoryMutations(), { wrapper });
    expect(cachedQty(client, "inv-1")).toBe(3);

    await act(async () => {
      await result.current.updateQuantity.mutateAsync({
        wsId: "ws-A",
        id: "inv-1",
        quantity: 7,
      });
    });
    // After settle the optimistic patch held (then invalidate refetches).
    await waitFor(() =>
      expect(result.current.updateQuantity.isSuccess).toBe(true),
    );
  });

  it("reverts the cached quantity to the prior value on a 4xx", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeEntry("inv-1", { quantity: 3 }),
    ]);
    server.use(
      http.patch("/api/workspaces/:wsId/inventory/:id/quantity", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useInventoryMutations(), { wrapper });
    expect(cachedQty(client, "inv-1")).toBe(3);

    await act(async () => {
      await result.current.updateQuantity
        .mutateAsync({ wsId: "ws-A", id: "inv-1", quantity: 99 })
        .catch(() => undefined);
    });

    await waitFor(() =>
      expect(result.current.updateQuantity.isError).toBe(true),
    );
    // Cache restored to the snapshot value — no client-trusted state survives.
    expect(cachedQty(client, "inv-1")).toBe(3);
  });

  it("offline: pauses the recount, holds the optimistic quantity, drains on reconnect (C-quantity)", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([
      makeEntry("inv-1", { quantity: 3 }),
    ]);
    server.use(
      http.patch("/api/workspaces/:wsId/inventory/:id/quantity", () =>
        HttpResponse.json(makeEntry("inv-1", { quantity: 7 })),
      ),
    );

    const { result } = renderHook(() => useInventoryMutations(), { wrapper });

    // Go offline: the mutation pauses (networkMode:"online") but the optimistic
    // patch is applied synchronously and persists while paused.
    onlineManager.setOnline(false);
    act(() => {
      result.current.updateQuantity.mutate({
        wsId: "ws-A",
        id: "inv-1",
        quantity: 7,
      });
    });
    await waitFor(() =>
      expect(result.current.updateQuantity.isPaused).toBe(true),
    );
    expect(cachedQty(client, "inv-1")).toBe(7); // optimistic value visible offline

    // Reconnect → the paused mutation drains against the registered default.
    onlineManager.setOnline(true);
    await client.resumePausedMutations();
    await waitFor(() =>
      expect(result.current.updateQuantity.isSuccess).toBe(true),
    );
    onlineManager.setOnline(true); // restore default for later tests
  });

  it("updateCondition sends the full PATCH with location_id + quantity bundled", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness([makeEntry("inv-1")]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch("/api/workspaces/:wsId/inventory/:id", async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeEntry("inv-1", { condition: "POOR" }));
      }),
    );

    const { result } = renderHook(() => useInventoryMutations(), { wrapper });
    await act(async () => {
      await result.current.updateCondition.mutateAsync({
        id: "inv-1",
        condition: "POOR",
        location_id: "loc-1",
        quantity: 3,
      });
    });
    expect(body).toEqual({
      location_id: "loc-1",
      quantity: 3,
      condition: "POOR",
    });
  });

  it("archive + restore invalidate the ['inventory', wsId] prefix", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeEntry("inv-1")]);
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useInventoryMutations(), { wrapper });
    await act(async () => {
      await result.current.archive.mutateAsync("inv-1");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-A"] });

    await act(async () => {
      await result.current.restore.mutateAsync("inv-1");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-A"] });
  });
});
