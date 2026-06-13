import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { labelsApi } from "@/lib/api/labels";
import { useLabelMutations } from "./useLabelMutations";

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

describe("useLabelMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("create PREFIX-invalidates ['labels', wsId] (no exact)", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLabelMutations(), { wrapper });
    await act(async () => {
      await result.current.create.mutateAsync({ name: "Fragile" });
    });

    await waitFor(() => expect(result.current.create.isSuccess).toBe(true));
    // PREFIX key — no exact:true (T-10-09).
    expect(spy).toHaveBeenCalledWith({ queryKey: ["labels", "ws-1"] });
  });

  it("update PREFIX-invalidates ['labels', wsId]", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const spy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLabelMutations(), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({
        id: "lbl-1",
        body: { name: "Loaned out" },
      });
    });

    await waitFor(() => expect(result.current.update.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ["labels", "ws-1"] });
  });

  it("archive calls labelsApi.archive and invalidates the prefix", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(labelsApi, "archive");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLabelMutations(), { wrapper });
    await act(async () => {
      await result.current.archive.mutateAsync({ id: "lbl-1", name: "Fragile" });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "lbl-1");
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["labels", "ws-1"] });
  });

  it("restore calls labelsApi.restore and invalidates the prefix", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(labelsApi, "restore");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLabelMutations(), { wrapper });
    await act(async () => {
      await result.current.restore.mutateAsync({ id: "lbl-1", name: "Fragile" });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "lbl-1");
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["labels", "ws-1"] });
  });

  it("del calls labelsApi.del and invalidates the prefix", async () => {
    setWsId("ws-1");
    const { client, wrapper } = makeHarness();
    const apiSpy = vi.spyOn(labelsApi, "del");
    const invSpy = vi.spyOn(client, "invalidateQueries");

    const { result } = renderHook(() => useLabelMutations(), { wrapper });
    await act(async () => {
      await result.current.del.mutateAsync({ id: "lbl-1", name: "Fragile" });
    });

    expect(apiSpy).toHaveBeenCalledWith("ws-1", "lbl-1");
    expect(invSpy).toHaveBeenCalledWith({ queryKey: ["labels", "ws-1"] });
  });

  it("create error path surfaces isError (failure toast fires)", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    server.use(
      http.post("/api/workspaces/:wsId/labels", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useLabelMutations(), { wrapper });
    await act(async () => {
      await result.current.create
        .mutateAsync({ name: "x" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.create.isError).toBe(true));
  });

  it("del error path surfaces isError (delete failure toast fires)", async () => {
    setWsId("ws-1");
    const { wrapper } = makeHarness();
    server.use(
      http.delete("/api/workspaces/:wsId/labels/:id", () =>
        HttpResponse.json({ message: "boom" }, { status: 500 }),
      ),
    );

    const { result } = renderHook(() => useLabelMutations(), { wrapper });
    await act(async () => {
      await result.current.del
        .mutateAsync({ id: "lbl-1", name: "x" })
        .catch(() => undefined);
    });

    await waitFor(() => expect(result.current.del.isError).toBe(true));
  });
});
