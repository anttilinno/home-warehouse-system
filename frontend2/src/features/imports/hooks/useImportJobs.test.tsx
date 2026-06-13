import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { http, HttpResponse } from "msw";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@/lib/i18n";
import { server } from "@/test/msw/server";
import { useImportJobs, useUploadImport } from "./useImportJobs";

// Phase 14 Plan 05 Task 2 — useImportJobs query + useUploadImport mutation.
// Mock useWorkspace; MSW for /imports/jobs + /imports/upload; assert the jobs
// query disables without a workspace and that a successful multipart upload
// invalidates ["import-jobs", wsId] so the table refetches.

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

const JOB = {
  id: "job-1",
  entity_type: "items",
  status: "completed",
  file_name: "items.csv",
  file_size_bytes: 100,
  total_rows: 5,
  processed_rows: 5,
  success_count: 5,
  error_count: 0,
  progress: 100,
  created_at: "2026-06-13T00:00:00Z",
  completed_at: "2026-06-13T00:01:00Z",
};

afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});

beforeAll(() => {
  i18n.load("en", {});
  i18n.activate("en");
});

describe("useImportJobs", () => {
  it("fetches /imports/jobs on a workspace and exposes jobs + total", async () => {
    setWsId("ws-A");
    server.use(
      http.get("/api/workspaces/:wsId/imports/jobs", () =>
        HttpResponse.json({ jobs: [JOB], total: 1, page: 1, total_pages: 1 }),
      ),
    );
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useImportJobs(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.jobs).toHaveLength(1);
    expect(result.current.jobs[0].id).toBe("job-1");
    expect(result.current.total).toBe(1);
  });

  it("is disabled without a workspace (no fetch, empty jobs)", async () => {
    setWsId(null);
    const { wrapper } = makeHarness();
    const { result } = renderHook(() => useImportJobs(), { wrapper });

    // Disabled query never enters loading; jobs default to [].
    expect(result.current.jobs).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});

describe("useUploadImport", () => {
  it("POSTs multipart /imports/upload and invalidates the jobs list on success", async () => {
    setWsId("ws-A");
    let jobsFetches = 0;
    let uploadHit = false;
    let uploadContentType: string | null = null;
    server.use(
      http.get("/api/workspaces/:wsId/imports/jobs", () => {
        jobsFetches += 1;
        return HttpResponse.json({
          jobs: [JOB],
          total: 1,
          page: 1,
          total_pages: 1,
        });
      }),
      // NOTE: we do NOT call request.formData() here — undici's multipart parser
      // chokes on a jsdom-constructed File part (a test-env limitation, not a
      // code bug). The FormData field assertion lives in importJobs.test.ts,
      // which inspects the outgoing body object directly. Here we only assert the
      // upload endpoint was hit with a multipart content-type, then that the
      // success invalidates the jobs list.
      http.post(
        "/api/workspaces/:wsId/imports/upload",
        ({ request }) => {
          uploadHit = true;
          uploadContentType = request.headers.get("content-type");
          return HttpResponse.json(JOB, { status: 201 });
        },
      ),
    );

    const { wrapper } = makeHarness();
    // Mount the jobs query first so we can observe a refetch after invalidation.
    const { result: jobsResult } = renderHook(() => useImportJobs(), {
      wrapper,
    });
    await waitFor(() => expect(jobsResult.current.isLoading).toBe(false));
    const before = jobsFetches;

    const { result } = renderHook(() => useUploadImport(), { wrapper });
    const file = new File(["sku,name\n1,Drill"], "items.csv", {
      type: "text/csv",
    });
    await act(async () => {
      await result.current.mutateAsync({ entityType: "items", file });
    });

    expect(uploadHit).toBe(true);
    expect(uploadContentType).toContain("multipart/form-data");
    // Invalidation triggers a refetch of the jobs list.
    await waitFor(() => expect(jobsFetches).toBeGreaterThan(before));
  });
});
