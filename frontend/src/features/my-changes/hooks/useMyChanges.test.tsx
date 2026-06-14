import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useMyChanges } from "./useMyChanges";

// Phase 14 Plan 02 Task 1 — useMyChanges hook tests. Mock useWorkspace (the
// D-12 wsId SSOT), MSW the /my-pending-changes endpoint, wrap in a
// QueryClientProvider. Contract: with a workspace the hook fetches and
// exposes `rows` (= changes) + `total`; with NO workspace the query is
// DISABLED (no request fires — enabled on wsId).

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

const CHANGE = {
  id: "chg-1",
  entity_type: "item",
  entity_id: "it-1",
  action: "update" as const,
  status: "pending" as const,
  created_at: "2026-06-13T00:00:00Z",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </I18nProvider>
  );
}

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

describe("useMyChanges", () => {
  beforeAll(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("with a workspace, fetches and exposes rows (changes) + total", async () => {
    setWsId("ws-1");
    server.use(
      http.get("/api/workspaces/:wsId/my-pending-changes", () =>
        HttpResponse.json({ changes: [CHANGE], total: 1 }),
      ),
    );

    const { result } = renderHook(() => useMyChanges(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toEqual([CHANGE]);
    expect(result.current.total).toBe(1);
  });

  it("with NO workspace the query is disabled — no request fires", async () => {
    setWsId(null);
    const requestSpy = vi.fn();
    server.use(
      http.get("/api/workspaces/:wsId/my-pending-changes", () => {
        requestSpy();
        return HttpResponse.json({ changes: [], total: 0 });
      }),
    );

    const { result } = renderHook(() => useMyChanges(), { wrapper });

    // Disabled query never loads and never fires the request.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.rows).toEqual([]);
    expect(requestSpy).not.toHaveBeenCalled();
  });
});
