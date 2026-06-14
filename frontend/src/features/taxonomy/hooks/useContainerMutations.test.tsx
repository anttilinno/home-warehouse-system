import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { containerApi } from "@/lib/api/container";
import { retroToast } from "@/components/retro";
import { useContainerMutations } from "./useContainerMutations";

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

describe("useContainerMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("create PREFIX-invalidates ['containers', wsId] (no exact)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync({
        name: "Crate",
        location_id: "loc-1",
      });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["containers", "ws-1"] });
  });

  it("update PREFIX-invalidates ['containers', wsId]", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "cont-1",
        body: { name: "Toolbox B" },
      });
    });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["containers", "ws-1"] });
  });

  it("del invalidates BOTH ['containers', wsId] AND ['inventory', wsId] (FK SET NULL cascade)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(containerApi, "del");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.del.mutateAsync({ id: "cont-1", name: "Toolbox A" });
    });

    await waitFor(() => expect(result.current.del.isSuccess).toBe(true));
    expect(apiSpy).toHaveBeenCalledWith("ws-1", "cont-1");
    // Double PREFIX-invalidate (T-10-05 / OQ2).
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["containers", "ws-1"] });
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["inventory", "ws-1"] });
  });

  it("del maps a 409 to a conflict toast", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    const toastSpy = vi.spyOn(retroToast, "error");
    server.use(
      http.delete("/api/workspaces/:wsId/containers/:id", () =>
        HttpResponse.json({ message: "in use" }, { status: 409 }),
      ),
    );

    const { result } = renderHook(() => useContainerMutations(), { wrapper });
    await act(async () => {
      await result.current.del
        .mutateAsync({ id: "cont-1", name: "Toolbox A" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.del.isError).toBe(true));
    expect(toastSpy).toHaveBeenCalledWith(
      expect.stringMatching(/still in use|can't be deleted/i),
    );
  });
});
