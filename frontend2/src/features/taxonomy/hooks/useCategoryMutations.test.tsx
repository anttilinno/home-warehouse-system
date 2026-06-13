import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { categoryApi } from "@/lib/api/category";
import { useCategoryMutations } from "./useCategoryMutations";
import { useUsageCount } from "./useUsageCount";

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

describe("useCategoryMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("create PREFIX-invalidates ['categories', wsId] (no exact)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCategoryMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync({ name: "Gadgets" });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    // PREFIX key — no exact:true (T-10-03).
    expect(spy).toHaveBeenCalledWith({ queryKey: ["categories", "ws-1"] });
  });

  it("update PREFIX-invalidates ['categories', wsId]", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCategoryMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "cat-tools",
        body: { name: "Tooling" },
      });
    });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["categories", "ws-1"] });
  });

  it("archive calls categoryApi.archive and invalidates the prefix", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(categoryApi, "archive");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useCategoryMutations(), { wrapper });
    await act(async () => {
      await result.current.archive.mutateAsync({
        id: "cat-tools",
        name: "Tools",
      });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "cat-tools");
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["categories", "ws-1"] });
  });

  it("restore calls categoryApi.restore", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    const apiSpy = vi.spyOn(categoryApi, "restore");

    const { result } = renderHook(() => useCategoryMutations(), { wrapper });
    await act(async () => {
      await result.current.restore.mutateAsync({
        id: "cat-tools",
        name: "Tools",
      });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "cat-tools");
  });

  it("create error path surfaces isError (failure toast fires)", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:wsId/categories", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useCategoryMutations(), { wrapper });
    await act(async () => {
      await result.current.create
        .mutateAsync({ name: "x" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.create.isError).toBe(true));
  });
});

describe("useUsageCount", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("fetchCount('category', id) reads the paginated .total (limit=1)", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    let seenUrl = "";
    server.use(
      http.get("/api/workspaces/:wsId/items", ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({
          items: [],
          total: 7,
          page: 1,
          total_pages: 1,
        });
      }),
    );

    const { result } = renderHook(() => useUsageCount(), { wrapper });
    let count = -1;
    await act(async () => {
      count = await result.current.fetchCount("category", "cat-electronics");
    });

    expect(count).toBe(7);
    expect(seenUrl).toContain("category_id=cat-electronics");
    expect(seenUrl).toContain("limit=1");
  });

  it("fetchCount('container', id) reads /inventory?container_id .total", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    let seenUrl = "";
    server.use(
      http.get("/api/workspaces/:wsId/inventory", ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({
          items: [],
          total: 3,
          page: 1,
          total_pages: 1,
        });
      }),
    );

    const { result } = renderHook(() => useUsageCount(), { wrapper });
    let count = -1;
    await act(async () => {
      count = await result.current.fetchCount("container", "cont-1");
    });

    expect(count).toBe(3);
    expect(seenUrl).toContain("container_id=cont-1");
    expect(seenUrl).toContain("limit=1");
  });
});
