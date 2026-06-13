import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useDeclutter, useMarkUsed } from "./useDeclutter";

// Phase 14 Plan 04 Task 2 — useDeclutter list hook + useMarkUsed mutation tests.
// MSW backs /declutter (bare { items, total }) + /inventory/{id}/mark-used.
// useWorkspace is mocked so the hook is enabled/disabled on wsId.

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

const ROW = {
  id: "inv-1",
  item_id: "it-1",
  item_name: "Drill",
  item_sku: "SKU-1",
  location_id: "loc-1",
  location_name: "Garage",
  category_id: "cat-1",
  category_name: "Tools",
  quantity: 1,
  days_unused: 200,
  score: 88,
};

function makeWrapper() {
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

describe("useDeclutter", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("fetches /declutter and exposes rows + total", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:wsId/declutter", () =>
        HttpResponse.json({ items: [ROW], total: 1 }),
      ),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeclutter({ groupBy: "none" }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.rows[0].id).toBe("inv-1");
    expect(result.current.total).toBe(1);
  });

  it("is disabled (no fetch) without a workspace", async () => {
    setWsId(null);
    const calls: string[] = [];
    server.use(
      http.get("/api/workspaces/:wsId/declutter", ({ request }) => {
        calls.push(request.url);
        return HttpResponse.json({ items: [], total: 0 });
      }),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useDeclutter({ groupBy: "none" }), {
      wrapper,
    });

    // No workspace → query never fires.
    expect(result.current.rows).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("re-queries when groupBy / thresholdDays change", async () => {
    setWsId("ws-A");
    const requested: string[] = [];
    server.use(
      http.get("/api/workspaces/:wsId/declutter", ({ request }) => {
        requested.push(new URL(request.url).search);
        return HttpResponse.json({ items: [ROW], total: 1 });
      }),
    );
    const { wrapper } = makeWrapper();

    const { result, rerender } = renderHook(
      ({ groupBy }: { groupBy: "none" | "category" }) =>
        useDeclutter({ groupBy }),
      { wrapper, initialProps: { groupBy: "none" as "none" | "category" } },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(1));

    rerender({ groupBy: "category" });

    await waitFor(() =>
      expect(requested.some((s) => s.includes("group_by=category"))).toBe(true),
    );
  });
});

describe("useMarkUsed", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("POSTs mark-used and invalidates the declutter list", async () => {
    setWsId("ws-A");
    let markUsedPath: string | null = null;
    let listCalls = 0;
    server.use(
      http.get("/api/workspaces/:wsId/declutter", () => {
        listCalls += 1;
        return HttpResponse.json({ items: [ROW], total: 1 });
      }),
      http.post(
        "/api/workspaces/:wsId/inventory/:inventoryId/mark-used",
        ({ request }) => {
          markUsedPath = new URL(request.url).pathname;
          return HttpResponse.json({ success: true, message: "ok" });
        },
      ),
    );
    const { wrapper } = makeWrapper();

    const { result } = renderHook(
      () => ({ list: useDeclutter({}), mark: useMarkUsed() }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    const before = listCalls;

    await act(async () => {
      await result.current.mark.mutateAsync("inv-1");
    });

    expect(markUsedPath).toBe("/api/workspaces/ws-A/inventory/inv-1/mark-used");
    // Invalidation triggers a refetch of the active list query.
    await waitFor(() => expect(listCalls).toBeGreaterThan(before));
  });
});
