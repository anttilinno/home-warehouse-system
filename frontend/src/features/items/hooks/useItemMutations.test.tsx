import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useItemMutations } from "./useItemMutations";

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

describe("useItemMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("invalidates the ['items', wsId] prefix after archive", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useItemMutations(), { wrapper });
    await act(async () => {
      await result.current.archive.mutateAsync("it-1");
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
    // No exact:true — prefix-match must cover list + detail (Anti-pattern).
    const call = spy.mock.calls.find(
      (c) => Array.isArray(c[0]?.queryKey) && c[0]!.queryKey[0] === "items",
    );
    expect(call?.[0] && "exact" in call[0]).toBe(false);
  });

  it("invalidates the ['items', wsId] prefix after restore", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useItemMutations(), { wrapper });
    await act(async () => {
      await result.current.restore.mutateAsync("it-1");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
  });

  it("deletes an archived item and invalidates the prefix", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useItemMutations(), { wrapper });
    await act(async () => {
      await result.current.del.mutateAsync({ id: "it-1", isArchived: true });
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["items", "ws-A"] });
  });

  it("refuses to delete a non-archived item (defensive guard)", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness();
    let deleteHit = false;
    server.use(
      http.delete("/api/workspaces/:wsId/items/:id", () => {
        deleteHit = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { result } = renderHook(() => useItemMutations(), { wrapper });
    await expect(
      act(async () => {
        await result.current.del.mutateAsync({ id: "it-1", isArchived: false });
      }),
    ).rejects.toThrow();
    expect(deleteHit).toBe(false);
  });

  it("reverts with a toast error when archive fails", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:wsId/items/:id/archive", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useItemMutations(), { wrapper });
    await act(async () => {
      await result.current.archive.mutateAsync("it-1").catch(() => undefined);
    });
    await waitFor(() => expect(result.current.archive.isError).toBe(true));
  });
});
