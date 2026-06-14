import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import type { Loan } from "@/lib/types";
import { useLoanMutations } from "./useLoanMutations";

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

function makeLoan(id: string, over: Partial<Loan> = {}): Loan {
  return {
    id,
    workspace_id: "ws-A",
    inventory_id: "inv-1",
    borrower_id: "b-1",
    quantity: 1,
    loaned_at: "2026-06-01T00:00:00Z",
    due_date: "2026-07-01T00:00:00Z",
    is_active: true,
    is_overdue: false,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    item: { id: "it-1", name: "Drill" },
    borrower: { id: "b-1", name: "Alice" },
    ...over,
  };
}

// Bare { items } list-cache shape (Pitfall 4) — matches loansApi.list typing.
const LIST_KEY = ["loans", "ws-A", { page: 1, limit: 50 }];

function makeHarness(seed: Loan[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(LIST_KEY, { items: seed });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
  return { client, wrapper };
}

function cached(client: QueryClient, id: string): Loan | undefined {
  const data = client.getQueryData<{ items: Loan[] }>(LIST_KEY);
  return data?.items.find((l) => l.id === id);
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useLoanMutations", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("returnLoan optimistically flips is_active→false in the cached list", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeLoan("loan-1")]);
    server.use(
      http.post("/api/workspaces/:wsId/loans/:id/return", () =>
        HttpResponse.json(makeLoan("loan-1", { is_active: false })),
      ),
    );

    const { result } = renderHook(() => useLoanMutations(), { wrapper });
    expect(cached(client, "loan-1")?.is_active).toBe(true);

    act(() => {
      result.current.returnLoan.mutate("loan-1");
    });
    // Optimistic flip is synchronous in onMutate.
    await waitFor(() =>
      expect(cached(client, "loan-1")?.is_active).toBe(false),
    );
    await waitFor(() =>
      expect(result.current.returnLoan.isSuccess).toBe(true),
    );
  });

  it("returnLoan reverts the cache to the snapshot on a 4xx", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeLoan("loan-1")]);
    server.use(
      http.post("/api/workspaces/:wsId/loans/:id/return", () =>
        HttpResponse.json({ message: "bad" }, { status: 422 }),
      ),
    );

    const { result } = renderHook(() => useLoanMutations(), { wrapper });
    await act(async () => {
      await result.current.returnLoan.mutateAsync("loan-1").catch(() => undefined);
    });

    await waitFor(() => expect(result.current.returnLoan.isError).toBe(true));
    // Restored to the snapshot — no client-trusted state survives a 4xx.
    expect(cached(client, "loan-1")?.is_active).toBe(true);
  });

  it("extendLoan optimistically patches due_date and sends new_due_date", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeLoan("loan-1")]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(
        "/api/workspaces/:wsId/loans/:id/extend",
        async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            makeLoan("loan-1", { due_date: "2026-08-15T00:00:00Z" }),
          );
        },
      ),
    );

    const { result } = renderHook(() => useLoanMutations(), { wrapper });
    act(() => {
      result.current.extendLoan.mutate({
        id: "loan-1",
        new_due_date: "2026-08-15T00:00:00Z",
      });
    });
    await waitFor(() =>
      expect(cached(client, "loan-1")?.due_date).toBe("2026-08-15T00:00:00Z"),
    );
    await waitFor(() =>
      expect(result.current.extendLoan.isSuccess).toBe(true),
    );
    expect(body).toEqual({ new_due_date: "2026-08-15T00:00:00Z" });
  });

  it("updateLoan optimistically patches due_date + notes", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeLoan("loan-1")]);
    server.use(
      http.patch("/api/workspaces/:wsId/loans/:id", () =>
        HttpResponse.json(
          makeLoan("loan-1", { notes: "be careful" }),
        ),
      ),
    );

    const { result } = renderHook(() => useLoanMutations(), { wrapper });
    act(() => {
      result.current.updateLoan.mutate({
        id: "loan-1",
        due_date: "2026-09-01T00:00:00Z",
        notes: "be careful",
      });
    });
    await waitFor(() => {
      const l = cached(client, "loan-1");
      expect(l?.due_date).toBe("2026-09-01T00:00:00Z");
      expect(l?.notes).toBe("be careful");
    });
    await waitFor(() =>
      expect(result.current.updateLoan.isSuccess).toBe(true),
    );
  });

  it("returnLoan invalidates the ['loans', wsId] prefix on settle", async () => {
    setWsId("ws-A");
    const { client, wrapper } = makeHarness([makeLoan("loan-1")]);
    const spy = vi.spyOn(client, "invalidateQueries");
    server.use(
      http.post("/api/workspaces/:wsId/loans/:id/return", () =>
        HttpResponse.json(makeLoan("loan-1", { is_active: false })),
      ),
    );

    const { result } = renderHook(() => useLoanMutations(), { wrapper });
    await act(async () => {
      await result.current.returnLoan.mutateAsync("loan-1");
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["loans", "ws-A"] });
  });
});
