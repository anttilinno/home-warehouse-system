import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { locationApi } from "@/lib/api/location";
import { useLocationMutations } from "./useLocationMutations";

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

describe("useLocationMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("create PREFIX-invalidates ['locations', wsId] (no exact)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync({ name: "Basement" });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["locations", "ws-1"] });
  });

  it("update PREFIX-invalidates ['locations', wsId]", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "loc-1",
        body: { name: "Workshop" },
      });
    });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["locations", "ws-1"] });
  });

  it("archive calls locationApi.archive and invalidates the prefix", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(locationApi, "archive");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.archive.mutateAsync({ id: "loc-1", name: "Garage" });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "loc-1");
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["locations", "ws-1"] });
  });

  it("restore calls locationApi.restore", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    const apiSpy = vi.spyOn(locationApi, "restore");

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.restore.mutateAsync({ id: "loc-1", name: "Garage" });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "loc-1");
  });

  it("does NOT expose a del mutation (TAX-04 archive-only)", () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    // Locations are archive-only — del must be absent (location hard-delete is
    // dangerous: CASCADE/RESTRICT). T-10-07 mitigation.
    expect((result.current as Record<string, unknown>).del).toBeUndefined();
  });

  it("create error path surfaces isError (failure toast fires)", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:wsId/locations", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useLocationMutations(), { wrapper });
    await act(async () => {
      await result.current.create
        .mutateAsync({ name: "x" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.create.isError).toBe(true));
  });
});
