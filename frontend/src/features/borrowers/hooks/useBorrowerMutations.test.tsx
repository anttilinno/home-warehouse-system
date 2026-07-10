import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { retroToast } from "@/components/retro";
import { useBorrowerMutations } from "./useBorrowerMutations";

// Phase 9 Plan 01 — BORR-02 create/update, BORR-05 delete. All three
// PREFIX-invalidate ["borrowers", wsId] (no `exact`) on success; del's onError
// maps a backend 400 (active-loans block) to a specific toast, everything
// else to the generic one.

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

describe("useBorrowerMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("create PREFIX-invalidates ['borrowers', wsId] on success", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.post("/api/workspaces/:ws/borrowers", () =>
        HttpResponse.json({
          id: "b-1",
          workspace_id: "ws-A",
          name: "Alice",
          is_archived: false,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        }),
      ),
    );

    const { result } = renderHook(() => useBorrowerMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync({ name: "Alice" });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["borrowers", "ws-A"] });
  });

  it("update PREFIX-invalidates ['borrowers', wsId] on success", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.patch("/api/workspaces/:ws/borrowers/:id", () =>
        HttpResponse.json({
          id: "b-1",
          workspace_id: "ws-A",
          name: "Alice B",
          is_archived: false,
          created_at: "2026-06-13T00:00:00Z",
          updated_at: "2026-06-13T00:00:00Z",
        }),
      ),
    );

    const { result } = renderHook(() => useBorrowerMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "b-1",
        body: { name: "Alice B" },
      });
    });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["borrowers", "ws-A"] });
  });

  it("del PREFIX-invalidates ['borrowers', wsId] on success", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.delete(
        "/api/workspaces/:ws/borrowers/:id",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    const { result } = renderHook(() => useBorrowerMutations(), { wrapper });
    await act(async () => {
      await result.current.del.mutateAsync("b-1");
    });

    await waitFor(() => expect(result.current.del.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["borrowers", "ws-A"] });
  });

  it("del maps a 400 (active loans) to the specific toast, not the generic one", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness();
    const toastSpy = vi.spyOn(retroToast, "error");
    server.use(
      http.delete("/api/workspaces/:ws/borrowers/:id", () =>
        HttpResponse.json(
          { message: "cannot delete borrower with active loans" },
          { status: 400 },
        ),
      ),
    );

    const { result } = renderHook(() => useBorrowerMutations(), { wrapper });
    await act(async () => {
      await result.current.del.mutateAsync("b-1").catch(() => undefined);
    });

    await waitFor(() => expect(result.current.del.isError).toBe(true));
    expect(toastSpy).toHaveBeenCalledWith(
      "Couldn't delete — this borrower has active loans.",
    );
  });

  it("del maps a non-400 failure to the generic toast", async () => {
    setWsId("ws-A");
    const { wrapper } = makeHarness();
    const toastSpy = vi.spyOn(retroToast, "error");
    server.use(
      http.delete("/api/workspaces/:ws/borrowers/:id", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useBorrowerMutations(), { wrapper });
    await act(async () => {
      await result.current.del.mutateAsync("b-1").catch(() => undefined);
    });

    await waitFor(() => expect(result.current.del.isError).toBe(true));
    expect(toastSpy).toHaveBeenCalledWith("Couldn't delete this borrower.");
  });
});
